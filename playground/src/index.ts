import { login, requireUser } from './auth'

const result = login('admin', 'guess')
const user = requireUser(result)

console.log(`signed in as ${user}`)
