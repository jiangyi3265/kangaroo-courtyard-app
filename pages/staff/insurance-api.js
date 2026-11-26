import { get, post } from '@/common/request.js'
const base = '/app/insurance'
export const insuranceApi = {
  context: storeId => get(base + '/context', { storeId }),
  rows: storeId => get(base + '/applies', { storeId }),
  application: id => get(base + '/applications/' + encodeURIComponent(id)),
  detail: id => get(base + '/applies/' + id),
  refundTasks: () => get(base + '/refund-tasks'),
  account: () => get(base + '/account'),
  create: body => post(base + '/applies', body),
  pay: id => post(base + '/applies/' + id + '/pay', {}),
  cancel: id => post(base + '/applies/' + id + '/cancel', {}),
  refund: (id, body) => post(base + '/applies/' + id + '/refund', body),
  departure: (id, rid, step, body) => post(base + '/applies/' + id + '/refund/' + rid + '/' + step, body),
  policy: (id, body) => post(base + '/applies/' + id + '/policy', body)
}
