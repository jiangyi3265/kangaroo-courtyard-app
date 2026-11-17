import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
const code = await fs.readFile(new URL('../pages/community/comment-upload.js', import.meta.url), 'utf8')
const {chooseCommentImages} = await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))
test('相册取消不报错，已有草稿不受影响', async () => {
  assert.deepEqual(await chooseCommentImages(2, opts => opts.fail({errMsg:'chooseImage:fail cancel'})), [])
})
test('拒绝相册权限和设备异常有可执行的错误提示', async () => {
  await assert.rejects(chooseCommentImages(3, opts => opts.fail({errMsg:'chooseImage:fail auth deny'})), /照片权限/)
  await assert.rejects(chooseCommentImages(3, () => { throw Error('not available') }), /照片权限/)
})
test('按剩余数量选图，最多三张', async () => {
  assert.deepEqual(await chooseCommentImages(2, opts => { assert.equal(opts.count,2);opts.success({tempFilePaths:['a.png','b.png']}) }), ['a.png','b.png'])
  await chooseCommentImages(8, opts => { assert.equal(opts.count,3);opts.success({tempFilePaths:[]}) })
})
