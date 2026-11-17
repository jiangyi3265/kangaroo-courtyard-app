import { apiCities } from '@/common/api.js'
import { get } from '@/common/request.js'

// Shared by the inline suggestions and the city picker; retry failed requests.
let directoryRequest
const jobs = new Map()
export function loadJobCityDirectory() {
  if (!directoryRequest) directoryRequest = apiCities().then(r => r?.data || {}).catch(error => { directoryRequest = null; throw error })
  return directoryRequest
}
export function loadJobCities(type) {
  if (type === 'online') return Promise.resolve([])
  if (!jobs.has(type)) jobs.set(type, get('/app/job/cities', { type }).then(r => r?.data || []).catch(error => { jobs.delete(type); throw error }))
  return jobs.get(type)
}
