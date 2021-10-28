import { useRef, useState, useMemo, useEffect, useCallback } from 'react'
import config from '../../config'
import { useCollection, useDocument, useRealtimeSnapshotCollection } from '../hooks/firebase'
import { Flex, Heading, Text, UnorderedList, ListItem } from '@chakra-ui/react'
import NewRecipient from '../components/new-recipient'
import ModalText from '../components/modal-text'
import ModalIncomingText from '../components/modal-incoming-text'
import { v4 as uuid } from 'uuid'
import { isEmpty } from 'lodash'

export default function Home() {
  const peerRef = useRef({})
  const [isModalTextOpen, setIsModalTextOpen] = useState(false)
  const [isModalIncomingOpen, setIsModalIncomingOpen] = useState(false)
  const [incomingMessage, setIncomingMessage] = useState()
  const [otherRecipient, setOtherRecipient] = useState()
  const [currentRecipient, setCurrentRecipient] = useState()
  const currentRecipientIDRef = useRef()
  const recipientCol = useCollection()
  const recipientSnapshot = useRealtimeSnapshotCollection('recipients', false)
  const otherRecipientSnapshot = recipientSnapshot.data?.filter((recipient) => recipient.id !== currentRecipient?.id)
  const iceCandidateCol = useCollection()
  const sessionDoc = useDocument()
  const sessionSnapshot = useRealtimeSnapshotCollection('sessions', true)
  const incomingOfferSnapshot = useMemo(() => {
    const filteredSessionSnapshot = sessionSnapshot.data
      ? sessionSnapshot.data.filter((sess) => sess.answerer.id === currentRecipient?.id && sess.offerer?.offer)
      : []
    return filteredSessionSnapshot.length > 0 ? filteredSessionSnapshot[filteredSessionSnapshot.length - 1] : {}
  }, [sessionSnapshot.data, currentRecipient?.id])
  const incomingAnswerSnapshot = useMemo(() => {
    const filteredSessionSnapshot = sessionSnapshot.data
      ? sessionSnapshot.data.filter((sess) => sess.offerer.id === currentRecipient?.id && sess.answerer?.answer)
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
    currentRecipientIDRef.current = id
  }

  const createPeer = useCallback(
    (currentRecipient, sessionID, otherRecipient, isOfferer, message) => {
      const peer = new RTCPeerConnection(config.rtcConfig)

      // Attach events
      peer.onicecandidate = (e) => {
        const handleIceCandidate = async (candidate, recipientID) => {
          await iceCandidateCol.createDoc(`icecandidates/${recipientID}/candidates`, { candidate })
        }
        if (e.candidate) {
          handleIceCandidate(e.candidate.toJSON(), currentRecipient.id)
        }
      }

      peer.oniceconnectionstatechange = (e) => {
        console.log(`RTC: ice connection state ${peer.iceConnectionState}`)
        if (peer.iceConnectionState === 'disconnected') {
          if (peerRef.current[sessionID]) {
            delete peerRef.current[sessionID]
          }
        }
      }

      peer.onconnectionstatechange = (e) => console.log(`RTC: connection state ${peer.connectionState}`)
      peer.onsignalingstatechange = (e) => console.log(`RTC: signaling state ${peer.signalingState}`)

      // Initiate data channel and attach events
      if (isOfferer) {
        const dc = peer.createDataChannel('data-channel')
        peer.dc = dc
        peer.dc.onopen = () => {
          console.log(`RTC: channel opened with ${otherRecipient.name}`)
          peer.dc.send(message)
        }
        peer.dc.onclose = () => {
          console.log(`RTC: channel closed ${otherRecipient.name}`)
        }
        peer.dc.onmessage = (e) => {
          setIncomingMessage(e.data)
          setIsModalIncomingOpen(true)
        }
      } else {
        peer.ondatachannel = (e) => {
          peer.dc = e.channel
          peer.dc.onopen = () => {
            console.log(`RTC: channel opened with ${otherRecipient.name}`)
          }
          peer.dc.onclose = () => {
            console.log(`RTC: channel closed ${otherRecipient.name}`)
          }
          peer.dc.onmessage = (e) => {
            setIncomingMessage(e.data)
            setIsModalIncomingOpen(true)
          }
        }
      }

      // Attach additional data
      peer.offererID = currentRecipient.id
      peer.answererID = otherRecipient.id

      return peer
    },
    [iceCandidateCol]
  )

  const findExistingPeer = (currentRecipientID, otherRecipientID) => {
    let sessionID = ''
    if (!isEmpty(peerRef.current)) {
      for (const id in peerRef.current) {
        const peer = peerRef.current[id]
        if (
          (peer.offererID === currentRecipientID && peer.answererID === otherRecipientID) ||
          (peer.offererID === otherRecipientID && peer.answererID === currentRecipientID)
        ) {
          sessionID = id
        }
      }
    }
    return sessionID
  }

  const handleSendMessage = async (message) => {
    const sessionID = findExistingPeer(currentRecipient.id, otherRecipient.id) || uuid()
    if (!peerRef.current[sessionID]) {
      // Create peer
      peerRef.current[sessionID] = createPeer(currentRecipient, sessionID, otherRecipient, true, message)

      // Initiate offer
      const offer = await peerRef.current[sessionID].createOffer()
      await peerRef.current[sessionID].setLocalDescription(offer)

      // Upsert session document
      await sessionDoc.upsert(`sessions/${sessionID}`, {
        offerer: {
          ...currentRecipient,
          offer: offer.toJSON()
        },
        answerer: {
          ...otherRecipient
        },
        status: 'offered'
      })
    } else {
      peerRef.current[sessionID].dc.send(message)
    }
    setOtherRecipient()
  }

  const handleChooseRecipient = (otherRecipient) => {
    setOtherRecipient(otherRecipient)
    setIsModalTextOpen(true)
  }

  // Handle incoming answer
  useEffect(() => {
    if (incomingAnswerSnapshot.status === 'answered') {
      const handleIncomingAnswer = async () => {
        const { answerer, id: sessionID } = incomingAnswerSnapshot
        // Attach remote description
        await peerRef.current[sessionID].setRemoteDescription(new RTCSessionDescription(answerer.answer))

        // Collecting ice candidate from answerer
        const candidates = await iceCandidateCol.get(`icecandidates/${answerer.id}/candidates`)
        for (const ice of candidates) {
          await peerRef.current[sessionID].addIceCandidate(new RTCIceCandidate(ice.candidate))
          await sessionDoc.remove(`icecandidates/${answerer.id}/candidates/${ice.id}`)
        }
        await sessionDoc.remove(`sessions/${sessionID}`)
      }
      handleIncomingAnswer()
    }
  }, [incomingAnswerSnapshot.status])

  // Handle incoming offer
  useEffect(() => {
    if (incomingOfferSnapshot.status === 'offered') {
      const handleIncomingOffer = async () => {
        const { offerer, id: sessionID } = incomingOfferSnapshot
        if (!peerRef.current[sessionID]) {
          // Create peer
          peerRef.current[sessionID] = createPeer(currentRecipient, sessionID, offerer, false)

          // Attach remote description
          await peerRef.current[sessionID].setRemoteDescription(new RTCSessionDescription(offerer.offer))

          // Initiate answer
          const answer = await peerRef.current[sessionID].createAnswer()
          await peerRef.current[sessionID].setLocalDescription(answer)
          await sessionDoc.upsert(`sessions/${sessionID}`, {
            answerer: {
              ...currentRecipient,
              answer: answer.toJSON()
            },
            status: 'answered'
          })

          // Collecting ice candidate from the offerer
          const candidates = await iceCandidateCol.get(`icecandidates/${offerer.id}/candidates`)
          for (const ice of candidates) {
            await peerRef.current[sessionID].addIceCandidate(new RTCIceCandidate(ice.candidate))
            await sessionDoc.remove(`icecandidates/${offerer.id}/candidates/${ice.id}`)
          }
        }
      }
      handleIncomingOffer()
    }
  }, [incomingOfferSnapshot.status])

  // Handle cleanup recipient
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentRecipientIDRef.current) {
        sessionDoc.remove(`recipients/${currentRecipientIDRef.current}`).then(() => {})
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [sessionDoc])

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
            &nbsp;to send text
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
