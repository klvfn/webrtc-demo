import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  Text,
  useClipboard
} from '@chakra-ui/react'

const ModalIncomingText = ({ isShow, setIsShow, offerer, message, setIncomingMessage }) => {
  const { hasCopied, onCopy } = useClipboard(message)
  const handleClose = () => {
    setIsShow(false)
    setIncomingMessage('')
  }

  return (
    <Modal isOpen={isShow} onClose={handleClose} isCentered={true} size='lg'>
      <ModalOverlay bg='blackAlpha.700' />
      <ModalContent>
        <ModalHeader>New message from {offerer?.name}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text>{message}</Text>
        </ModalBody>

        <ModalFooter justifyContent='flex-end'>
          <Button colorScheme='teal' bg='teal.400' color='white' fontWeight='bold' mr={4} onClick={onCopy}>
            {hasCopied ? 'Copied' : 'Copy'}
          </Button>
          <Button variant='ghost' color='white' fontWeight='bold' onClick={handleClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ModalIncomingText
