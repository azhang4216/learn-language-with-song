interface GoogleCredentialResponse {
  credential: string
}

interface GoogleAccountsId {
  initialize: (options: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
  }) => void
  renderButton: (
    parent: HTMLElement,
    options: Record<string, string | number | boolean>,
  ) => void
  cancel: () => void
}

interface Window {
  google?: { accounts: { id: GoogleAccountsId } }
}
