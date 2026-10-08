export interface Response<T> {
  ticketId: string
  data: T
  status: number
  message: string
}

export default { Response }
