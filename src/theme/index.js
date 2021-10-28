import { extendTheme } from '@chakra-ui/react'

const overrides = extendTheme({
  fonts: {
    heading: 'poppins',
    body: 'poppins'
  },
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false
  }
})

export default overrides
