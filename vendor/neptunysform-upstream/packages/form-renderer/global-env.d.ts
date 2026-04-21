declare global {
  interface Window {
    neptunysform: {
      device: {
        ios: boolean
        android: boolean
        mobile: boolean
        windowHeight: number
        screenHeight: number
      }
    }
  }
}

export {}
