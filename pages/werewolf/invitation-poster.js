import courtyard from './static/courtyard.jpg'
import atlas from './static/characters.png'

const width = 600
const height = 900

export async function saveInvitation(code, qr, room = {}) {
	let canvas
	// #ifdef H5
	canvas = document.createElement('canvas')
	canvas.width = width
	canvas.height = height
	// #endif
	// #ifdef MP-WEIXIN
	canvas = wx.createOffscreenCanvas({ type: '2d', width, height })
	// #endif
	const load = (src) =>
		new Promise((resolve, reject) => {
			// #ifdef H5
			const image = new Image()
			// #endif
			// #ifdef MP-WEIXIN
			const image = canvas.createImage()
			// #endif
			image.onload = () => resolve(image)
			image.onerror = () => reject(new Error('邀请卡图片加载失败，请重试'))
			image.src = src
		})
	const [background, characters] = await Promise.all([load(courtyard), load(atlas)])
	const ctx = canvas.getContext('2d')
	ctx.fillStyle = '#FCF9F3'
	ctx.fillRect(0, 0, width, height)
	ctx.drawImage(background, 0, 0, width, 400)
	const cellWidth = characters.width / 4
	const cellHeight = characters.height / 3
	for (let i = 0; i < 3; i++)
		ctx.drawImage(
			characters,
			i * cellWidth,
			0,
			cellWidth,
			cellHeight,
			15 + i * 185,
			85,
			205,
			275
		)
	ctx.fillStyle = '#3A322B'
	ctx.textAlign = 'center'
	ctx.font = 'bold 34px sans-serif'
	ctx.fillText('一起玩袋鼠狼人杀', 300, 450)
	ctx.fillStyle = '#6F6A65'
	ctx.font = '22px sans-serif'
	ctx.fillText((room.playerCount || 6) + '人好友局 · ' + (room.playMode === 'face_to_face' ? '线下面对面' : '线上组局'), 300, 490)
	ctx.font = '20px sans-serif'
	ctx.fillText('房间号', 300, 540)
	ctx.fillStyle = '#244B3C'
	ctx.font = 'bold 60px sans-serif'
	ctx.fillText(code, 300, 605)
	if (qr?.state === 'ready' && qr.image) {
		const image = await load(qr.image)
		ctx.drawImage(image, 220, 635, 160, 160)
		ctx.font = '20px sans-serif'
		ctx.fillText('扫码进入房间', 300, 830)
	} else {
		ctx.font = '24px sans-serif'
		ctx.fillText('打开小程序，进入「社区」', 300, 690)
		ctx.font = '20px sans-serif'
		ctx.fillText('袋鼠狼人杀 → 输入房间号', 300, 735)
	}
	// #ifdef H5
	const link = document.createElement('a')
	link.href = canvas.toDataURL('image/png')
	link.download = '袋鼠狼人杀-' + code + '.png'
	link.click()
	return '邀请卡已生成'
	// #endif
	// #ifdef MP-WEIXIN
	const file = await new Promise((resolve, reject) =>
		wx.canvasToTempFilePath({
			canvas,
			fileType: 'png',
			success: (r) => resolve(r.tempFilePath),
			fail: () => reject(new Error('邀请卡生成失败，请重试'))
		})
	)
	await new Promise((resolve, reject) =>
		uni.saveImageToPhotosAlbum({
			filePath: file,
			success: resolve,
			fail: () => reject(new Error('保存失败，请在微信设置中允许相册权限后重试'))
		})
	)
	return '邀请卡已保存到相册'
	// #endif
}
