import { get, post, getToken } from './request.js'
import { API_BASE } from './config.js'
export const governanceGet = (path, data = {}) => get('/app/governance/' + path, data)
export const governancePost = (path, data = {}) => post('/app/governance/' + path, data)
export const mediationStates = { pending: '待接单', accepted: '已接单', verifying: '核实中', ready: '待裁决', jury: '大众评审中', confirmation: '待双方确认', appealed: '总部复核中', closed: '已关闭' }
export const juryChoices = [{ value: 'user', label: '支持用户' }, { value: 'merchant', label: '支持店家' }, { value: 'both', label: '双方均有责' }, { value: 'insufficient', label: '证据不足' }]
export function uploadEvidence(path, redacted = false) {
  return new Promise((resolve, reject) => uni.uploadFile({
    url: API_BASE + '/app/governance/files', filePath: path, name: 'file',
    header: { 'X-App-Token': getToken() || '' }, formData: { redacted: String(redacted) },
    success: r => { try { const body = JSON.parse(r.data); if (body.code !== 200) throw new Error(body.msg || '证据上传失败'); resolve(body.data) } catch (e) { reject(e) } }, fail: reject
  }))
}
export async function evidenceLink(id) {
  const r = await governanceGet('files/' + id)
  return { ...r.data, url: API_BASE + r.data.url }
}
