// common/upload.js 的 downloadError：下载接口回来的是错误 JSON 还是真正的文件。
// 每日经营报表「下载 Excel」出错时（没权限、登录失效、选了未来日期），服务端回 {code, msg}，HTTP 状态码多半仍是 200；
// 以前小程序端一律提示"打开文件失败"、H5 一律"下载失败"，看不到原因。
import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false } })
const { downloadError, DOWNLOAD_ERROR_MAX } = await vite.ssrLoadModule('/common/upload.js')
await vite.close()

test('a {code,msg} body is an error and the server message is shown as-is', () => {
  assert.equal(downloadError('{"code":403,"msg":"没有该门店的经营报表权限"}', ''), '没有该门店的经营报表权限')
  assert.equal(downloadError('{"msg":"未登录或登录已失效","code":401}', 'application/json;charset=UTF-8'), '未登录或登录已失效')
  assert.equal(downloadError('  {"code":500,"msg":"不能查看未来的日期"}\n', ''), '不能查看未来的日期')
})

test('without a usable msg the error code is reported instead of a vague failure', () => {
  assert.equal(downloadError('{"code":500}', ''), '下载失败（错误码 500）')
  assert.equal(downloadError('{"code":422,"msg":"   "}', ''), '下载失败（错误码 422）')
})

test('a JSON body is never treated as the file, even with code 200', () => {
  assert.equal(downloadError('{"code":200,"msg":"操作成功"}', ''), '下载失败，服务端没有返回文件')
  assert.equal(downloadError('{"code":200,"msg":"操作成功","data":null}', 'application/json'), '下载失败，服务端没有返回文件')
})

test('a JSON content type with an unparsable body is still an error', () => {
  assert.equal(downloadError('', 'application/json'), '下载失败，服务端没有返回文件')
  assert.equal(downloadError('not json', 'application/json;charset=UTF-8'), '下载失败，服务端没有返回文件')
})

test('real file content is not an error', () => {
  // xlsx 是 zip 包，开头是 PK；小程序读不到内容时传空串
  assert.equal(downloadError('PK\u0003\u0004\u0014\u0000\u0006\u0000', ''), '')
  assert.equal(downloadError('', ''), '')
  assert.equal(downloadError('', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), '')
  assert.equal(downloadError(null, ''), '')
  // JSON 但不是 {code,msg} 形状（例如一份 JSON 导出文件）不算错误
  assert.equal(downloadError('{"rows":[1,2,3]}', ''), '')
  assert.equal(downloadError('[{"code":1}]', ''), '')
})

test('only short bodies are inspected', () => {
  const big = '{"code":500,"msg":"' + 'x'.repeat(DOWNLOAD_ERROR_MAX) + '"}'
  assert.equal(downloadError(big, ''), '')
  assert.equal(DOWNLOAD_ERROR_MAX >= 1024, true)
})
