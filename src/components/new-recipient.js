import { Flex, Heading, Input, InputGroup, InputRightElement, IconButton } from '@chakra-ui/react'
import { useState } from 'react'
import { ArrowForwardIcon } from '@chakra-ui/icons'

const NewRecipient = ({ handleNewRecipient, isLoading }) => {
  const [name, setName] = useState('')
  const handleSubmit = (e) => {
    e.preventDefault()
    handleNewRecipient(name)
    setName('')
  }

  return (
    <Flex direction='column'>
      <Heading as='h1' fontSize='lg' mb='5'>
        You want to be known as
      </Heading>
      <form onSubmit={handleSubmit}>
        <Flex>
          <InputGroup>
            <Input
              textTransform='capitalize'
              placeholder='Your name'
              type='text'
              value={name}
              onChange={(e) => setName(e.target.value)}
              color='white'
              _placeholder={{ color: 'white', opacity: '0.5' }}
              pl='3'
              borderColor='whiteAlpha.700'
              focusBorderColor='white'
              borderWidth='revert'
            />
            <InputRightElement h='full' w='fit-content'>
              <IconButton
                isLoading={isLoading}
                colorScheme='teal'
                bg='whiteAlpha.400'
                color='white'
                fontWeight='bold'
                type='submit'
                roundedTopLeft='none'
                roundedBottomLeft='none'
                _hover={{ bg: 'rgba(255,255,255,0.4)' }}
                icon={<ArrowForwardIcon w='4' h='4' />}
              >
                Submit
              </IconButton>
            </InputRightElement>
          </InputGroup>
        </Flex>
      </form>
    </Flex>
  )
}

export default NewRecipient
