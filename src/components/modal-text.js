import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  Input
} from '@chakra-ui/react'
import { useRef, useState } from 'react'

const ModalText = ({ isShow, setIsShow, handleSendMessage }) => {
  const [message, setMessage] = useState('')
  const inputRef = useRef()
  const handleClose = () => {
    setIsShow(false)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    handleSendMessage(message)
    setMessage('')
    handleClose()
  }

  return (
    <Modal isOpen={isShow} onClose={handleClose} isCentered={true} size='lg' initialFocusRef={inputRef}>
      <ModalOverlay bg='blackAlpha.700' />
      <ModalContent>
        <ModalHeader>Send a text</ModalHeader>
        <ModalCloseButton />
        <form onSubmit={handleSubmit}>
          <ModalBody>
            <Input
              ref={inputRef}
              placeholder='Your text'
              type='text'
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              color='white'
              _placeholder={{ color: 'white', opacity: '0.5' }}
              pl='3'
              borderColor='whiteAlpha.700'
              focusBorderColor='white'
              borderWidth='revert'
            />
          </ModalBody>

          <ModalFooter justifyContent='flex-end'>
            <Button
              type='submit'
              colorScheme='teal'
              bg='teal.400'
              color='white'
              fontWeight='bold'
              onClick={handleSubmit}
            >
              Send
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}

export default ModalText
