import { useRef, useState, useMemo, useEffect } from 'react'
import config from '../../config'
import { useCollection, useDocument, useRealtimeSnapshotCollection } from '../hooks/firebase'
import { Flex, Heading, Text, UnorderedList, ListItem } from '@chakra-ui/react'
import NewRecipient from '../components/new-recipient'
import ModalText from '../components/modal-text'
import ModalIncomingText from '../components/modal-incoming-text'

export default function Home() {
  const peerRef = useRef({})
  const [isModalTextOpen, setIsModalTextOpen] = useState(false)
  const [isModalIncomingOpen, setIsModalIncomingOpen] = useState(false)
  const [incomingMessage, setIncomingMessage] = useState()
  const [otherRecipient, setOtherRecipient] = useState()
  const [currentRecipient, setCurrentRecipient] = useState()
  const currentRecipientRef = useRef()
  const recipientCol = useCollection()
  const recipientSnapshot = useRealtimeSnapshotCollection('recipients', false)
  const otherRecipientSnapshot = recipientSnapshot.data?.filter((recipient) => recipient.id !== currentRecipient?.id)
  const iceCandidateCol = useCollection()
  const sessionDoc = useDocument()
  const sessionSnapshot = useRealtimeSnapshotCollection('sessions', true)
  const incomingOfferSnapshot = useMemo(() => {
    const filteredSessionSnapshot = sessionSnapshot.data
      ? sessionSnapshot.data.filter((sess) => sess.id.endsWith(currentRecipient?.id) && sess.offerer?.offer)
      : []
    return filteredSessionSnapshot.length > 0 ? filteredSessionSnapshot[filteredSessionSnapshot.length - 1] : {}
  }, [sessionSnapshot.data, currentRecipient?.id])
  const incomingAnswerSnapshot = useMemo(() => {
    const filteredSessionSnapshot = sessionSnapshot.data
      ? sessionSnapshot.data.filter((sess) => sess.id.startsWith(currentRecipient?.id) && sess.answerer?.answer)
      : []
    return filteredSessionSnapshot.length > 0 ? filteredSessionSnapshot[filteredSessionSnapshot.length - 1] : {}
  }, [sessionSnapshot.data, currentRecipient?.id])

  const handleNewRecipient = async (name) => {
    const recipient = {
      name
    }
    const id = await recipientCol.createDoc('recipients', recipient)
    setCurrentRecipient({
      id,
      ...recipient
    })
    currentRecipientRef.current = {
      id,
      ...recipient
    }
  }

  const createPeer = (localRecipientID) => {
    const peer = new RTCPeerConnection(config.rtcConfig)
    peer.onicecandidate = (e) => {
      const handleIceCandidate = async (candidate, recipientID) => {
        await iceCandidateCol.createDoc(`icecandidates/${recipientID}/candidates`, candidate)
      }
      if (e.candidate) {
        handleIceCandidate(e.candidate.toJSON(), localRecipientID)
      }
    }
    peer.oniceconnectionstatechange = (e) => console.log(`RTC: ice connection state ${peer.iceConnectionState}`)
    peer.onconnectionstatechange = (e) => console.log(`RTC: connection state ${peer.connectionState}`)
    peer.onsignalingstatechange = (e) => console.log(`RTC: signaling state ${peer.signalingState}`)
    return peer
  }

  const handleSendMessage = async (message) => {
    const sessionID = `${currentRecipient.id}-${otherRecipient.id}`
    if (!peerRef.current[sessionID]) {
      // Create peer
      peerRef.current[sessionID] = createPeer(currentRecipient.id)
      peerRef.current[sessionID].as = 'offerer'

      // Initiate data channel
      const dc = peerRef.current[sessionID].createDataChannel('data-channel')
      dc.onopen = (e) => {
        console.log(`RTC: channel opened with ${otherRecipient.name}`)
        dc.send(message)
      }
      dc.onclose = (e) => {
        console.log(`RTC: channel closed ${otherRecipient.name}`)
      }
      peerRef.current[sessionID].dc = dc

      // Initiate offer
      const offer = await peerRef.current[sessionID].createOffer()
      await peerRef.current[sessionID].setLocalDescription(offer)

      // Upsert session document
      await sessionDoc.upsert(`sessions/${sessionID}`, {
        offerer: {
          ...currentRecipient,
          offer: offer.toJSON()
        },
        status: 'offered'
      })
      setOtherRecipient()
    } else {
      peerRef.current[sessionID].dc.send(message)
      await sessionDoc.upsert(`sessions/${sessionID}`, {
        status: 'text-sent'
      })
      setOtherRecipient()
    }
  }

  const handleAcceptMessage = async (offerer) => {
    const sessionID = `${offerer.id}-${currentRecipient.id}`
    if (!peerRef.current[sessionID]) {
      // Create peer
      peerRef.current[sessionID] = createPeer(currentRecipient.id)
      peerRef.current[sessionID].as = 'answerer'

      // Attach data channel
      peerRef.current[sessionID].ondatachannel = (e) => {
        console.log(`RTC: channel opened with ${offerer.name}`)
        peerRef.current[sessionID].dc = e.channel
        peerRef.current[sessionID].dc.onmessage = (ev) => {
          setIncomingMessage(ev.data)
          setIsModalIncomingOpen(true)
        }
      }

      // Attach remote description
      await peerRef.current[sessionID].setRemoteDescription(new RTCSessionDescription(offerer.offer))

      // Initiate answer
      const answer = await peerRef.current[sessionID].createAnswer()
      await peerRef.current[sessionID].setLocalDescription(answer)
      await sessionDoc.upsert(`sessions/${offerer.id}-${currentRecipient.id}`, {
        answerer: {
          ...currentRecipient,
          answer: answer.toJSON()
        },
        status: 'answered'
      })

      // Collecting ice candidate from the offerer
      const candidates = await iceCandidateCol.get(`icecandidates/${offerer.id}/candidates`)
      for (const candidate of candidates) {
        await peerRef.current[sessionID].addIceCandidate(new RTCIceCandidate(candidate))
      }
    } else {
      await sessionDoc.upsert(`sessions/${sessionID}`, {
        status: 'text-received'
      })
    }
  }

  const handleChooseRecipient = (otherRecipient) => {
    setOtherRecipient(otherRecipient)
    setIsModalTextOpen(true)
  }

  // Handle incoming answer
  useEffect(() => {
    if (incomingAnswerSnapshot.status === 'answered') {
      const sessionID = `${currentRecipient.id}-${incomingAnswerSnapshot.answerer.id}`
      const handleAcceptIncomingAnswer = async (answerer) => {
        // Attach remote description
        await peerRef.current[sessionID].setRemoteDescription(new RTCSessionDescription(answerer.answer))

        // Collecting ice candidate from answerer
        const candidates = await iceCandidateCol.get(`icecandidates/${answerer.id}/candidates`)
        for (const candidate of candidates) {
          await peerRef.current[sessionID].addIceCandidate(new RTCIceCandidate(candidate))
        }

        await sessionDoc.upsert(`sessions/${sessionID}`, {
          status: 'connected'
        })
      }
      handleAcceptIncomingAnswer(incomingAnswerSnapshot.answerer)
    }
  }, [incomingAnswerSnapshot?.status])

  // Handle accept message
  useEffect(() => {
    if (incomingOfferSnapshot.status === 'offered' || incomingOfferSnapshot.status === 'text-sent') {
      handleAcceptMessage(incomingOfferSnapshot.offerer)
    }
  }, [incomingOfferSnapshot?.status])

  useEffect(() => {
    const handleBeforeUnload = () => {
      const disconnect = async () => {
        const promises = []
        if (currentRecipientRef.current) {
          promises.push(
            sessionDoc.remove(`recipients/${currentRecipientRef.current.id}`),
            sessionDoc.remove(`icecandidates/${currentRecipientRef.current.id}`)
          )
        }

        if (peerRef.current) {
          Object.keys(peerRef.current).map((s) => promises.push(sessionDoc.remove(`sessions/${s}`)))
        }

        if (promises.length > 0) {
          await Promise.all(promises)
        }
      }
      disconnect()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  return (
    <Flex justify='center' direction='column' align='center' textAlign='left' height='100vh'>
      <ModalText isShow={isModalTextOpen} setIsShow={setIsModalTextOpen} handleSendMessage={handleSendMessage} />
      <ModalIncomingText
        isShow={isModalIncomingOpen}
        setIsShow={setIsModalIncomingOpen}
        offerer={incomingOfferSnapshot.offerer}
        message={incomingMessage}
        setIncomingMessage={setIncomingMessage}
      />
      {currentRecipient?.id && otherRecipientSnapshot.length > 0 && (
        <Flex color='whiteAlpha.700' mb='10'>
          <Text as='i'>
            Choose available recipient and use&nbsp;
            <Text as='b' color='teal.400'>
              left click
            </Text>
            &nbsp;to send text or&nbsp;
            <Text as='b' color='teal.400'>
              right click
            </Text>
            &nbsp;to send files
          </Text>
        </Flex>
      )}
      <Flex direction='column' justify='center' bg='teal.400' rounded='3xl' px='6' py='8' color='white'>
        {currentRecipient?.id ? (
          otherRecipientSnapshot.length > 0 ? (
            <>
              <Heading as='h1' fontSize='lg' textAlign='center' fontFamily='inherit'>
                Available Recipients
              </Heading>
              <UnorderedList
                display='flex'
                flexFlow='row wrap'
                justifyContent='space-around'
                textAlign='center'
                styleType='none'
                ml='0'
                width='sm'
                mt='8'
              >
                {otherRecipientSnapshot.map((recipient) => (
                  <ListItem
                    key={recipient.id}
                    bg='white'
                    transition='all'
                    _hover={{ bg: 'rgba(255,255,255,0.9)' }}
                    transitionDuration='200ms'
                    cursor='pointer'
                    mb='3'
                    mr='1'
                    rounded='xl'
                    py='4'
                    color='teal.400'
                    width='44'
                    onClick={() => handleChooseRecipient(recipient)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                    }}
                  >
                    <Text textTransform='capitalize'>{recipient.name}</Text>
                  </ListItem>
                ))}
              </UnorderedList>
            </>
          ) : (
            <Heading as='h1' fontSize='lg' textAlign='center' fontFamily='inherit'>
              Connect from another devices to start sharing data
            </Heading>
          )
        ) : (
          <NewRecipient handleNewRecipient={handleNewRecipient} isLoading={recipientCol.isLoading} />
        )}
      </Flex>
      {currentRecipient?.id && (
        <Flex mt='10' color='whiteAlpha.700'>
          <Text as='i'>
            You will be known as{' '}
            <Text as='b' color='teal.400' textTransform='capitalize'>
              {currentRecipient.name}
            </Text>
          </Text>
        </Flex>
      )}
    </Flex>
  )
}
