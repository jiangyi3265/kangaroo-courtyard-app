import { get, post } from '@/common/request.js'
const base = '/app/insurance'
export const insuranceApi = {
  context: storeId => get(base + '/context', { storeId }),
  rows: storeId => get(base + '/applies', { storeId }),
  detail: id => get(base + '/applies/' + id),
  account: () => get(base + '/account'),
  create: body => post(base + '/applies', body),
  pay: id => post(base + '/applies/' + id + '/pay', {}),
  cancel: id => post(base + '/applies/' + id + '/cancel', {}),
  refund: (id, body) => post(base + '/applies/' + id + '/refund', body),
  policy: (id, body) => post(base + '/applies/' + id + '/policy', body)
}
