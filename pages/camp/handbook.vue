<template>
  <view class="k-page handbook">
    <k-topbar title="袋鼠使用手册" back />
    <view class="handbook-body">
      <view class="handbook-cover"><text class="cover-label">袋鼠全球青年 / 出行指南</text><text class="cover-title">把下一站，<br />过成喜欢的日常。</text><text class="cover-copy">从第一次报名到安心入住，<br />这几件事，出发前一起了解。</text><view class="cover-foot"><k-icon name="book-open" :size="22" color="green" /><text>袋鼠使用手册</text></view></view>
      <view class="contents"><text class="contents-label">这本手册里</text><view v-for="section in sections" :key="section.id" class="contents-row" role="button" @click="jump(section.id)"><text class="section-number">{{ section.number }}</text><text>{{ section.title }}</text><text>↓</text></view></view>
      <view v-for="section in sections" :id="section.id" :key="section.id" class="manual-section"><text class="section-kicker">{{ section.number }} / {{ section.label }}</text><text class="section-title">{{ section.title }}</text><rich-text :nodes="section.content" /></view>
      <view class="manual-end"><text>旅途有伴，心里有底。</text><text>具体岗位、费用和退订规则，请以对应详情、协议与确认页面为准。</text><button @click="go('/pages/camp/index')">去袋鼠青年营地 ›</button></view>
    </view>
  </view>
</template>
<script setup>
import { go } from '@/common/screen.js'
const paragraph = text => `<p style="margin:0 0 16px;font-size:15px;line-height:1.9;color:#5a5149;">${text}</p>`
const step = (title, body) => `<h3 style="margin:24px 0 8px;font-size:17px;line-height:1.6;color:#3a322b;">${title}</h3>${paragraph(body)}`
const sections = [
  { id:'apply', number:'01', label:'从心动到出发', title:'报名，一步一步来', content:
    paragraph('先找到适合自己的岗位或活动，把时间、地点和参与条件看清楚，再做决定。') +
    step('第一步 · 选城市，看详情', '浏览岗位时，重点了解工作内容、参与日期、食宿安排与申请条件。活动请确认集合地点、开始时间、名额和费用。') +
    step('第二步 · 完善资料，提交报名', '按页面提示登录、填写报名所需资料，并核对联系电话。确认内容无误后提交；提交成功不代表已经录用或可以直接到店。') +
    step('第三步 · 查看进度，完成确认', '在“我的”中查看报名进度。岗位按实际要求完成审核、面试、双方确认和协议签署；活动按报名页提示完成确认或支付。') +
    step('第四步 · 确认后再安排出发', '收到明确确认后，再核对到达时间、地址与接待安排。如计划有变，请及时按页面规则办理并联系相关负责人。') },
  { id:'stay', number:'02', label:'住进喜欢的小院', title:'自营订房，找订房助手', content:
    paragraph('自营房源由订房助手协助确认，让房型、日期和入住安排都说清楚。') +
    step('先看房源，再联系', '进入自营小院详情，查看房型、位置和入住说明，点击底部“联系订房助手”，打开微信客服会话。') +
    step('告诉助手你的入住计划', '准备好入住与离店日期、入住人数、房型偏好和需要确认的问题。页面价格仅作参考，请与助手确认可订情况、总费用及取消规则。') +
    step('保留明确的预订确认', '按官方客服给出的流程办理，核对房源、日期、人数和费用，并妥善保存确认记录。未收到确认前，请不要把咨询当作预订成功。') +
    step('代运营房源如何预订？', '在详情页选择房型和日期，阅读预订须知与取消规则，核对金额后按页面提示直接支付；支付和订单状态可在“我的”中查看。') },
  { id:'groups', number:'03', label:'认识旅途同伴', title:'一座城，两种相遇', content:
    step('同城群 · 找到此刻身边的人', '从“我的”进入“袋鼠青年营地”。允许定位后，会识别当前城市并展示同城群；定位失败或暂不授权时，也可以手动选择城市。') +
    step('目的地群 · 提前认识下一站', '营地会参考你最近浏览或报名的城市推荐目的地群，也支持手动选城。点击社群卡片，长按识别企业微信群活码加入；未开放的城市会显示提示。') },
  { id:'safety', number:'04', label:'安心出行', title:'把安全放进行李里', content:
    step('出发前，再核对一次', '确认地址、到达时间和接待联系方式，把行程告知可信赖的亲友。带好本人有效证件；食宿、工作或活动安排有疑问时，先沟通清楚。') +
    step('保护资料与支付信息', '不在公开群聊发送身份证照片、银行卡信息或验证码。付款前核对渠道与收款信息；遇到陌生账号催促转账，请先通过小程序官方客服核实。') +
    step('共同生活，尊重边界', '遵守住宿及活动约定，照顾公共空间，尊重同伴的个人意愿与隐私。遇到不适合的安排，及时表达并联系负责人协调。') +
    step('遇到问题，保存记录', '保留相关订单、聊天和凭证，通过小程序客服反馈。若现场存在紧急危险，先离开危险区域，向当地紧急服务求助。') }
]
function jump(id) { uni.pageScrollTo({ selector:'#' + id, duration:250, offsetTop:-90 }) }
</script>
<style scoped>
.handbook-body { max-width:660px; margin:auto; padding:18px 22px calc(36px + var(--k-safe-bottom)); }.handbook-cover { background:#e4edda; border-radius:18px; padding:30px 24px; }.cover-label { display:block; color:#4a6e3a; font-size:11px; letter-spacing:1px; }.cover-title { display:block; margin:26px 0 18px; color:#3a4931; font-size:28px; font-weight:700; line-height:1.5; }.cover-copy { display:block; color:#56644b; font-size:14px; line-height:1.9; }.cover-foot { display:flex; gap:10px; align-items:center; margin-top:38px; font-size:13px; color:#4a6e3a; }.contents { margin:32px 0 8px; }.contents-label { color:#6f6a65; font-size:12px; }.contents-row { display:flex; gap:16px; align-items:center; min-height:52px; border-bottom:1px solid #e2dbcf; font-size:15px; color:#3a322b; }.contents-row>text:nth-child(2) { flex:1; }.section-number { color:#9a6b3f; font-size:12px; }.manual-section { padding-top:40px; }.section-kicker { display:block; color:#9a6b3f; font-size:12px; letter-spacing:1px; }.section-title { display:block; font-size:24px; line-height:1.5; font-weight:600; color:#3a322b; margin:10px 0 22px; }.manual-end { margin-top:32px; padding:28px 0 0; border-top:1px solid #e2dbcf; }.manual-end>text { display:block; }.manual-end>text:first-child { font-size:22px; font-weight:600; color:#4a6e3a; }.manual-end>text:nth-child(2) { margin:14px 0 24px; font-size:12px; line-height:1.8; color:#6f6a65; }.manual-end button { min-height:46px; line-height:46px; background:#8a5e36; color:#fcf9f3; font-size:15px; border-radius:24px; }
</style>
