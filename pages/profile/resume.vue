<template>
  <k-feature-gate feature="recruitment">
  <view class="k-page resume" :class="$userSurface">
    <k-topbar :title="titles[s - 1]" back custom-back :fab="!editing" @back="onBack">
      <!-- 基本信息、技能这两屏是填写屏：标题和输入框从屏幕边开始，浮动客服钮滑到哪儿都压字。这两屏不出浮动钮，客服放顶栏返回箭头旁边，一样一直看得到、一样在左边 -->
      <template #left>
        <!-- #ifdef MP-WEIXIN -->
        <button v-if="navKefu" class="nav-kefu" open-type="contact" :session-from="kefuFrom" hover-class="k-press" aria-label="联系人工客服"><k-icon name="headset" :size="14" color="ink2" /><text>客服</text></button>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <view v-if="navKefu" class="nav-kefu" hover-class="k-press" aria-label="联系人工客服" @click="go('/pages/notice/support')"><k-icon name="headset" :size="14" color="ink2" /><text>客服</text></view>
        <!-- #endif -->
      </template>
      <view v-if="s === 4" class="tabs">
        <view v-for="(t, i) in expTabs" :key="t" class="tabs__item" :class="{ active: tab === i }" @click="tab = i"><text>{{ t }}</text></view>
      </view>
    </k-topbar>

    <!-- 概览只保留摘要，编辑和完整匹配列表按需展开。 -->
    <view v-if="resumeState === 'loading' || resumeState === 'error'" class="k-body k-pad-tab resume-home">
      <text>{{ resumeState === 'error' ? '简历读取失败，请重新加载后编辑' : '正在读取简历…' }}</text>
      <k-button v-if="resumeState === 'error'" type="secondary" label="重新加载" @click="load" />
    </view>
    <view v-else-if="s === 1" class="k-body k-pad-tab resume-home">
      <!-- 11-18 第三轮：名片卡 = 头像 + 称呼 + 年龄城市，完整度收进名片卡底部一行；隐私说明挪到页尾当脚注 -->
      <!-- 11-18 第四轮：名片区去掉卡，做成「个人主页头」（头像 64 + 小眉题「基本信息」+ 名字 22 + 信息 13，右边「编辑简历」文字链）；完整度、技能、三栏经历合进下面一张白卡 -->
      <view class="resume-person-card">
      <view class="resume-person" hover-class="k-press" @click="s = 2">
        <image class="resume-person__avatar" :src="form.lifePhotoUrl ? absUrl(form.lifePhotoUrl) : '/static/media/profile-avatar.jpg'" mode="aspectFill" />
        <view class="resume-person__info"><view class="summary-heading resume-person-heading"><text>基本信息</text></view><text class="resume-person__name">{{ form.name || '填写基本信息' }}</text><text class="resume-person__meta">{{ [form.gender, form.age ? form.age + '岁' : '', form.city].filter(Boolean).join(' · ') || '称呼、年龄、联系方式与所在城市' }}</text></view>
        <text class="resume-edit">编辑简历</text><k-icon name="chevron-right" :size="14" color="red" />
      </view>
      </view>
      <view class="resume-skills-card">
      <view class="resume-summary" hover-class="k-press" @click="goMissing">
        <view class="summary-badge" :style="{ background: 'conic-gradient(var(--k-red) ' + score + '%, var(--k-line) 0)' }"><view class="summary-badge__inner"><text class="summary-percent">{{ pct }}</text></view></view>
        <view class="summary-copy"><text class="summary-eyebrow">完整度</text><view class="summary-heading"><text>完善简历，发现机会</text></view><view class="k-bar"><view class="k-bar__fill" :style="pctStyle" /></view><text class="summary-hint">{{ missing.length ? '基本信息 · 技能特长 · 真实经历' : '已完善，报名时确认投递即可' }}</text></view>
        <k-icon v-if="missing.length" name="chevron-right" :size="14" color="muted" />
      </view>
      <view class="resume-skills" hover-class="k-press" @click="s = 3">
        <view class="summary-heading"><text>技能与特长</text><text class="resume-edit">编辑</text></view>
        <view class="resume-skills__body" :class="{ 'is-empty': !skill }"><k-icon v-if="!skill" name="pencil" :size="14" color="red" /><text class="resume-skills__text">{{ skill || '会做饭、拍照、接待，都可以成为你的优势' }}</text></view>
      </view>
      <view class="resume-experiences">
        <view v-for="(e, ei) in expStats" :key="e.title" hover-class="k-press" @click="openExps(ei)"><view class="resume-experiences__label"><k-icon :name="['house','briefcase','building-2'][ei]" :size="14" color="muted" /><text>{{ ['换工经历','兼职经历','全职经历'][ei] }}</text><k-icon name="chevron-right" :size="12" color="muted" /></view><view class="resume-experiences__more"><text class="resume-experiences__count">{{ e.num || 0 }} 段 </text></view></view>
      </view>
      </view>
      <view class="resume-opportunities">
        <view class="summary-heading"><text>技能匹配机会</text><k-icon name="sparkles" :size="16" color="red" /></view>
        <view class="resume-opportunities__layout"><view class="resume-opportunities__emblem"><k-icon name="badge-check" :size="22" color="red" /></view><view class="resume-opportunities__main"><text class="resume-opportunities__desc">{{ oppLoaded ? (oppJobs.length ? '已找到 ' + (opp.jobs || []).length + ' 个相关机会，看看哪份适合你' : oppEmptyText) : (oppError || '正在匹配适合你的机会…') }}</text><k-button block type="secondary" size="sm" :label="oppError ? '重新匹配' : '查看匹配机会'" @click="oppError ? loadOpp() : go(R.opportunities + '?s=2')" /></view></view>
      </view>
      <view class="privacy-note"><k-icon name="shield-check" :size="14" color="muted" /><text>简历仅在报名时脱敏展示，保护你的隐私</text></view>
    </view>

    <!-- 2 基本信息编辑 -->
    <view v-else-if="s === 2" class="k-body k-pad-tab resume-editor">
      <view class="resume-import" hover-class="k-press" @click="importResume"><view><text>已有简历？直接导入</text><text>支持 PDF / DOCX / TXT，5MB 以内</text></view><text>{{ importing ? '识别中…' : '导入简历' }}</text></view>
      <text class="k-title k-mt16 b">基本信息</text>

      <view class="form k-mt10">
        <view class="form__row">
          <view class="form__label"><text>称呼</text><text class="req">*</text></view>
          <view class="k-input form__input"><input v-model="form.name" @focus="onDraftFocus" maxlength="32" placeholder="怎么称呼你，不必填写真实姓名" placeholder-class="k-placeholder" /></view>
        </view>
        <view class="form__row">
          <view class="form__label"><text>性别</text><text class="req">*</text></view>
          <view class="k-row k-gap10">
            <view v-for="g in ['女', '男', '其他']" :key="g" class="gender" :class="{ on: form.gender === g }" @click="form.gender = g"><text>{{ g }}</text></view>
          </view>
        </view>
        <view class="form__row">
          <view class="form__label"><text>年龄</text><text class="req">*</text></view>
          <view class="k-input form__input"><input v-model="form.age" @focus="onDraftFocus" type="number" maxlength="3" placeholder="请输入年龄" placeholder-class="k-placeholder" /></view>
        </view>
        <view class="form__row">
          <view class="form__label"><text>联系电话</text><text class="req">*</text></view>
          <view class="k-input form__input"><input v-model="form.phone" @focus="onDraftFocus" type="number" maxlength="11" placeholder="请输入 11 位手机号" placeholder-class="k-placeholder" /></view>
        </view>
        <view class="form__row">
          <view class="form__label"><text>所在城市</text><text class="req">*</text></view>
          <view class="k-input form__input" @click="pickCity"><text class="k-flex1">{{ form.city || '请选择' }}</text><k-icon name="chevron-right" :size="12" color="muted" /></view>
        </view>
      </view>

      <view class="resume-section-head"><text>认识你</text><text>以下内容选填</text></view>
      <view class="editor-card editor-card--lines">
      <view class="editor-field editor-field--line"><text>兴趣爱好</text><view class="k-input"><input v-model="form.hobbies" @focus="onDraftFocus" maxlength="120" placeholder="例如：摄影、徒步、桌游" placeholder-class="k-placeholder" /></view></view>
      <view class="editor-field editor-field--line"><text>性格特点</text><view class="k-input"><input v-model="form.personality" @focus="onDraftFocus" maxlength="120" placeholder="例如：开朗、耐心、有责任心" placeholder-class="k-placeholder" /></view></view>
      <view class="editor-field"><text>自我介绍</text><textarea v-model="form.intro" @focus="onDraftFocus" maxlength="200" placeholder="简单介绍自己，让店家更了解你" placeholder-class="k-placeholder" /></view>
      </view>
      <view class="resume-section-head"><text>相关经历与作品</text><text>选填</text></view>
      <view class="editor-card">
      <view class="editor-field"><text>相关专业或过往经历</text><textarea v-model="form.background" @focus="onDraftFocus" maxlength="1000" placeholder="学过什么、做过什么，或想尝试什么" placeholder-class="k-placeholder" /></view>
      <view class="resume-media">
        <view class="resume-media__add" hover-class="k-press" @click="addResumeMedia('image')"><k-icon name="image-plus" :size="22" color="red" /><text>上传图片</text></view>
        <view class="resume-media__add" hover-class="k-press" @click="addResumeMedia('video')"><k-icon name="video" :size="22" color="red" /><text>上传视频</text></view>
      </view>
      <text class="k-meta">照片每张不超过20MB，视频每个不超过200MB；上传完成后请保存简历。</text>
      <view v-for="(item, i) in form.media" :key="item.key" class="resume-uploaded"><k-icon :name="item.kind === 'video' ? 'video' : 'image'" :size="20" color="muted" /><text>{{ item.name }}</text><view hover-class="k-press" @click="form.media.splice(i,1)"><k-icon name="x" :size="18" color="muted" /></view></view>
      </view>
      <view class="resume-section-head"><text>本人特长</text><text>选填</text></view>
      <view class="editor-card">
      <view class="editor-field"><textarea v-model="skill" @focus="onDraftFocus" maxlength="1000" placeholder="别小看自己的能力：做饭、摄影、剪辑、接待，都值得写下来" placeholder-class="k-placeholder" /></view>
      </view>
      <view class="resume-photo" hover-class="k-press" @click="addResumeMedia('portrait')"><image v-if="form.lifePhotoUrl" :src="absUrl(form.lifePhotoUrl)" mode="aspectFill" /><k-icon v-else name="camera" :size="24" color="red" /><view><text>本人生活照</text><text>{{ form.lifePhoto ? '已上传，点击更换' : '选填，上传一张清晰的生活照' }}</text></view><k-icon name="chevron-right" :size="12" color="muted" /></view>
      <text v-if="uploading" class="upload-hint">正在上传，请稍候…</text>
      <k-button block class="k-mt16" :disabled="saving || uploading || importing || expSaving" :label="saving ? '保存中…' : '保存简历'" @click="save" />
    </view>

    <!-- 3 自由技能编辑 -->
    <view v-else-if="s === 3" class="k-body k-pad-tab resume-skills-editor">
      <view class="tip">
        <view class="tip__icon"><k-icon name="info" :size="14" color="muted" /></view>
        <text class="tip__text">没有预设标签，尽情描述你的技能与特长；系统按关键词把技能归到标签上用于匹配，原文保留。</text>
      </view>

      <view class="skills-card">
      <view class="k-between k-mt16"><view class="form__label form__label--lg"><text>技能描述</text><text class="req">*</text></view><text class="k-text k-muted">{{ skill.length }}/1000</text></view>
      <!-- 同上：不打字时用普通 view 显示，避免原生 textarea 盖住底部导航 -->
      <view class="area area--tall k-mt8">
        <textarea v-if="editingSkill" v-model="skill" @focus="onDraftFocus" :maxlength="1000" placeholder="例如：会修自行车、电动车的小毛病；会做简单的咖啡；做过两个月前台接待……写满 20 字计入完整度" placeholder-class="k-placeholder" :focus="true" auto-focus @blur="skill = $event.detail.value; editingSkill = false" />
        <view v-else class="resume-area-idle" @click="editingSkill = true"><text :class="{ 'k-placeholder': !skill }">{{ skill || '例如：会修自行车、电动车的小毛病；会做简单的咖啡；做过两个月前台接待……写满 20 字计入完整度' }}</text></view>
      </view>
      <text v-if="skill.length < 20" class="k-small k-muted skill-hint">再写 {{ 20 - skill.length }} 个字，完整度 +{{ skill ? 15 : 25 }}%</text>

      <view class="k-between k-mt16"><view class="form__label form__label--lg"><text>补充说明</text><text class="k-muted form__hint">（可选，多段描述）</text></view><text class="k-text k-muted">{{ extra.length }}/1000</text></view>
      <view class="area area--mid k-mt8">
        <textarea v-if="editingExtra" v-model="extra" @focus="onDraftFocus" :maxlength="1000" placeholder-class="k-placeholder" :focus="true" auto-focus @blur="extra = $event.detail.value; editingExtra = false" />
        <view v-else class="resume-area-idle" @click="editingExtra = true"><text>{{ extra }}</text></view>
      </view>

      <view class="k-between k-mt16"><view class="form__label form__label--lg"><text>作品/作品链接</text><text class="k-muted form__hint">（可选）</text></view><text class="k-text k-muted">{{ links.length }}/10</text></view>
      <view v-for="(l, i) in links" :key="i" class="k-input link k-mt8">
        <k-icon name="link" :size="16" color="ink2" />
        <text class="link__url k-ellipsis">{{ l }}</text>
        <view @click="links.splice(i, 1)"><k-icon name="circle-x" :size="18" color="muted" /></view>
      </view>
      <view class="addlink k-mt8" hover-class="k-press" @click="addLink"><k-icon name="plus" :size="16" color="red" /><text>添加链接</text></view>
      </view>

      <k-button block class="k-mt16" :disabled="saving || uploading || importing || expSaving" :label="saving ? '保存中…' : '保存'" @click="save" />
    </view>

    <!-- 4 经历列表 -->
    <view v-else class="k-body k-pad-tab resume-history">
      <!-- 2026-11-03 主人：简化 —— 自己填的经历：点卡片在下面的小表单里改，右边「×」删除；平台记录的（已入职 / 已完成岗位自动生成）不能改、没有「×」 -->
      <view v-for="(e, i) in volunteer" v-if="tab === 0" :key="e.expId" class="card exp" :class="{ 'k-mt12': i > 0, 'exp--own': e.source !== 'platform' }" hover-class="k-press-s" @click="editExp(e)">
        <view class="exp__ph"><k-icon name="house" :size="22" color="red" /></view>
        <view class="k-flex1 k-col">
          <text class="exp__title">{{ e.title }}</text>
          <text class="k-small k-muted k-mt2">{{ e.place }}</text>
          <view class="k-row k-gap16 k-mt6"><text class="k-text k-muted">{{ e.range }}</text><text class="k-text k-muted">{{ e.total }}</text></view>
          <view class="k-row k-gap6 k-mt4">
            <text class="k-small">评价：</text>
            <view class="stars"><view v-for="n in 5" :key="n" class="star">
              <k-icon name="star" :size="12" color="ochre" :fill="n <= Math.floor(e.stars)" />
              <view v-if="e.stars && n === Math.ceil(e.stars) && e.stars % 1" class="star__half"><k-icon name="star-half" :size="12" color="ochre" fill /></view>
            </view></view>
            <text class="k-small">{{ e.comment }}</text>
          </view>
        </view>
        <view v-if="e.source !== 'platform'" class="exp__x" hover-class="k-press" @click.stop="removeExp(e)"><k-icon name="x" :size="16" color="muted" /></view>
      </view>

      <view v-if="tab === 1 && !parttime.length" class="exp-empty"><view class="exp-empty__ic"><k-icon name="briefcase" :size="32" color="red" /></view><text class="k-title k-mt16 b">还没有兼职经历</text></view>
      <view v-for="e in parttime" v-if="tab === 1" :key="e.expId" class="card exp k-mt8" :class="{ 'exp--own': e.source !== 'platform' }" hover-class="k-press-s" @click="editExp(e)">
        <view class="exp__ph"><k-icon name="briefcase" :size="22" color="red" /></view>
        <view class="k-flex1 k-col">
          <text class="exp__title">{{ e.title }}</text>
          <text class="k-small k-muted k-mt2">{{ e.place }}</text>
          <view class="k-row k-gap16 k-mt6"><text class="k-text k-muted">{{ e.range }}</text><text class="k-text k-muted">{{ e.total }}</text></view>
        </view>
        <view v-if="e.source !== 'platform'" class="exp__x" hover-class="k-press" @click.stop="removeExp(e)"><k-icon name="x" :size="16" color="muted" /></view>
      </view>

      <view v-if="tab === 2" class="exp-cert" hover-class="k-press" @click="openCert"><k-icon name="award" :size="16" color="red" /><text class="k-title k-mt16 b">全职/培训经历 · 查看认证</text><k-icon name="chevron-right" :size="14" color="muted" /></view>
      <view v-for="e in training" v-if="tab === 2" :key="e.expId" class="card exp k-mt8" :class="{ 'exp--own': e.source !== 'platform' }" hover-class="k-press-s" @click="editExp(e)">
        <view class="exp__ph"><k-icon :name="e.kind === 'training' ? 'graduation-cap' : 'building-2'" :size="22" color="red" /></view>
        <view class="k-flex1 k-col">
          <text class="exp__title">{{ e.title }}</text>
          <text class="k-small k-muted k-mt2">{{ e.place }}</text>
          <text class="k-text k-muted k-mt6">{{ e.range }}</text>
          <view class="k-row k-gap16 k-mt4"><text class="k-small">考核等级：{{ e.level || '—' }}</text><text class="k-small">{{ e.kind === 'training' ? '培训' : '全职' }}</text></view>
        </view>
        <view v-if="e.source !== 'platform'" class="exp__x" hover-class="k-press" @click.stop="removeExp(e)"><k-icon name="x" :size="16" color="muted" /></view>
      </view>

      <!-- 2026-11-03 主人：简化 —— 添加 / 修改经历在这块小表单里一次填完（原来要连弹 4–5 个输入框 + 类型菜单，改要先弹「修改 / 删除」菜单） -->
      <view v-if="expForm.open" class="card exp-form k-mt16">
        <text v-if="expSaving" class="exp-form__title">正在保存经历…</text>
        <template v-else>
        <text class="exp-form__title">{{ expForm.expId ? '修改经历' : '添加经历' }}</text>
        <view class="exp-form__row exp-form__row--top"><text class="exp-form__label">类型</text><view class="exp-form__pills"><view v-for="k in KIND" :key="k[0]" class="exp-form__pill" :class="{ on: expForm.kind === k[0] }" hover-class="k-press-s" @click="expForm.kind = k[0]"><text>{{ k[1] }}</text></view></view></view>
        <view class="exp-form__row"><text class="exp-form__label">名称<text class="req">*</text></text><view class="k-input exp-form__input"><input v-model="expForm.title" maxlength="60" placeholder="岗位 / 课程名，如：咖啡店周末店员" placeholder-class="k-placeholder" /></view></view>
        <view class="exp-form__row"><text class="exp-form__label">门店 · 城市</text><view class="k-input exp-form__input"><input v-model="expForm.place" maxlength="60" placeholder="如：喜洲手作小店 · 大理" placeholder-class="k-placeholder" /></view></view>
        <view class="exp-form__row"><text class="exp-form__label">开始日期</text><picker class="exp-form__input" mode="date" :value="expForm.startDate || today" :end="today" @change="expForm.startDate = $event.detail.value"><view class="k-input exp-form__pick"><text :class="{ 'k-placeholder': !expForm.startDate }">{{ expForm.startDate || '选填，点这里选' }}</text><k-icon name="chevron-right" :size="12" color="muted" /></view></picker><view v-if="expForm.startDate" class="exp-form__clear" hover-class="k-press" @click="expForm.startDate = ''"><k-icon name="x" :size="16" color="muted" /></view></view>
        <view class="exp-form__row"><text class="exp-form__label">结束日期</text><picker class="exp-form__input" mode="date" :value="expForm.endDate || today" :start="expForm.startDate || ''" :end="today" @change="expForm.endDate = $event.detail.value"><view class="k-input exp-form__pick"><text :class="{ 'k-placeholder': !expForm.endDate }">{{ expForm.endDate || '至今（不填）' }}</text><k-icon name="chevron-right" :size="12" color="muted" /></view></picker><view v-if="expForm.endDate" class="exp-form__clear" hover-class="k-press" @click="expForm.endDate = ''"><k-icon name="x" :size="16" color="muted" /></view></view>
        <view v-if="expForm.kind === 'training'" class="exp-form__row"><text class="exp-form__label">考核等级</text><view class="k-input exp-form__input"><input v-model="expForm.level" maxlength="20" placeholder="选填，例如：A / 初级" placeholder-class="k-placeholder" /></view></view>
        <view class="exp-form__btns"><view class="exp-form__btn"><k-button block type="outline" label="取消" @click="expForm.open = false" /></view><view class="exp-form__btn"><k-button block :disabled="saving" label="保存经历" @click="saveExp" /></view></view>
        </template>
      </view>
      <k-button v-else block icon="plus" class="k-mt16" @click="addExp">新增经历</k-button>
    </view>

    <k-tabbar active="profile" />
  </view>
  </k-feature-gate>
</template>

<script setup>
import { selectCity } from '@/common/city-picker.js'
// ---------------------------------------------------------------------------
// 我的简历接入情况：
//   s=1 概览：完整度（按填写项计算）、基本信息、技能描述、三类经历的段数与累计时长
//   s=2 基本信息：保存到服务端；「一键复用」= 从最近一次报名表带出称呼、年龄、电话、技能
//   s=3 技能描述：原文保留；标签由关键词词典归类（不是 AI），在「找机会」页查看来源
//   s=4 经历：平台记录（已入职 / 已完成的岗位自动生成，不可改）+ 自己补充的经历（可改可删）
// 简历只在报名时给到对应门店，门店侧手机号脱敏。
// ---------------------------------------------------------------------------
import { ref, reactive, computed, watch, onUnmounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useScreen, go, back, toast } from '@/common/screen.js'
import { apiResume, apiOpportunities, apiResumeBasic, apiResumeSkills, apiResumeReuse, apiResumeAddExp, apiResumeEditExp, apiResumeRemoveExp } from '@/common/api.js'
import { ensureSession, experience, session, currentStaffStore, getSessionRevision } from '@/common/experience.js'
import { fabVisible, fabSessionFrom } from '@/common/support-fab.js'
import { prompt, confirm, errText, isYmd, todayCn } from '@/common/ui.js'
import { chooseResumeDocument } from './resume-import.js'
import { absUrl, chooseImage, uploadTo } from '@/common/upload.js'
import R from '@/common/routes.js'

let landing = 1
let ready = false, disposed = false, readRevision = 0, oppRevision = 0
const captureScope = () => ({ id: String(experience.account?.id || ''), revision: getSessionRevision() })
let accountScope = captureScope()
const isCurrent = scope => !!scope && !disposed && scope.id === String(experience.account?.id || '') && scope.revision === getSessionRevision()
const actionScope = () => { if (syncAccountScope()) return null; return accountScope.id && isCurrent(accountScope) ? accountScope : null }
const s = useScreen(4, { onLoad: async () => { landing = s.value; await ensureSession(); if (disposed) return; syncAccountScope(); ready = true; return load() } })
// 填写屏不出浮动客服钮，顶栏放一个（谁能看到还是同一条规则，见 common/support-fab.js）
const editing = computed(() => s.value === 2 || s.value === 3)
const navKefu = computed(() => editing.value && fabVisible({ route: 'pages/profile/resume', restored: session.restored, mode: experience.mode, roleCode: currentStaffStore.value && currentStaffStore.value.roleCode, dark: false }))
const kefuFrom = computed(() => fabSessionFrom(experience.account && experience.account.id))
const titles = ['简历与机会', '基本信息编辑', '自由技能编辑', '经历列表']
// 之前：从一键报名「去补充」、个人资料「编辑资料」（?s=2）、找机会「查看全部 / 编辑」（?s=3 / ?s=4）、任务页（?s=4）直接打开某一屏时，
// 返回落到简历概览，要多按一次才回到原页面继续操作。现在直接打开的那一屏返回原页面；页内点进去的屏仍回概览
const onBack = () => { if (s.value > 1 && s.value !== landing) s.value = 1; else back() }
// 到过概览之后，各屏的返回都回概览
watch(s, (v) => { if (v === 1) landing = 1 })
const tab = ref(0)
const expTabs = ['换工经历', '兼职经历', '全职/培训经历']
const data = ref({ resume: {}, exps: [], stats: [], completeness: 0 })
const form = reactive({ name: '', gender: '女', age: '', phone: '', city: '', intro: '', hobbies: '', personality: '', background: '', lifePhoto: '', lifePhotoUrl: '', media: [] })
const skill = ref('')
const extra = ref('')
const links = ref([])
// 多行输入框只在打字时渲染真正的 textarea：原生层会盖住底部导航，点导航会点到输入框
const editingIntro = ref(false)
const editingSkill = ref(false)
const editingExtra = ref(false)
const resumeState = ref('loading')
let editorVisit = 0
// 切屏时收起，回到这一屏不会自己弹键盘
watch(s, () => { editorVisit++; editingIntro.value = false; editingSkill.value = false; editingExtra.value = false; expForm.open = false }, { flush: 'sync' })
async function load() {
  const scope = accountScope, request = ++readRevision
  if (!isCurrent(scope)) return
  if (!scope.id) { resumeState.value = 'guest'; return }
  resumeState.value = 'loading'
  loadOpp()
  try {
    const response = await apiResume()
    if (isCurrent(scope) && request === readRevision) apply(response.data)
  } catch (e) {
    if (isCurrent(scope) && request === readRevision) {
      resumeState.value = 'error'
      toast(errText(e, '简历加载失败'))
    }
  }
}
// ---------------- s=1 下半部分：技能匹配机会 ----------------
// 读不到不提示（简历是这页的主体），这一块就不显示；改完技能保存回到概览时重读一次
const opp = ref({ jobs: [] })
const oppLoaded = ref(false)
const oppError = ref('')
async function loadOpp() {
  const scope = accountScope, request = ++oppRevision
  if (!scope.id || !isCurrent(scope)) return
  oppError.value = ''
  try {
    const response = await apiOpportunities()
    if (!isCurrent(scope) || request !== oppRevision) return
    opp.value = response.data || { jobs: [] }
    oppLoaded.value = true
  } catch (e) { if (isCurrent(scope) && request === oppRevision) oppError.value = '匹配暂时没有加载出来，点击重试' }
}
const skillTags = computed(() => (data.value.tags || []).slice(0, 8))
// 匹配是按技能标签算的（服务端 opportunities 回的 skills）：一个标签都没有时分数里的技能那一项是默认值，百分比没有依据，这时不列机会
const oppSkillBased = computed(() => (opp.value.skills || []).length > 0)
const oppEmptyText = computed(() => (oppSkillBased.value ? '暂时没有和你技能匹配的机会，去岗位列表看看全部机会'
  : skill.value ? '你写的技能暂时没有对应的岗位标签，多写几项（如咖啡、摄影、前台接待）就能为你匹配机会'
    : '写一段技能描述，就能按技能为你匹配机会'))
const oppJobs = computed(() => (oppSkillBased.value ? opp.value.jobs || [] : []).slice(0, 3).map(j => ({
  jobId: j.jobId, title: j.title, match: (j.score || 0) + '%', reason: j.reason || '',
  img: j.cover ? absUrl(j.cover) : '/static/media/cover-empty.png', hasImg: !!j.cover,
  meta: [j.typeLabel, j.storeName, j.city, j.dateText].filter(Boolean).join(' · ')
})))
function apply(d, section = 0) {
  resumeState.value = 'ready'
  data.value = d
  const r = d.resume || {}
  if (section !== 3) Object.assign(form, { name: r.name || '', gender: r.gender || '女', age: r.age == null ? '' : String(r.age), phone: r.phone || '', city: r.city || '', intro: r.intro || '', hobbies: r.hobbies || '', personality: r.personality || '', background: r.background || '', lifePhoto: r.lifePhoto || '', lifePhotoUrl: r.lifePhotoUrl || '', media: [...(r.media || [])] })
  skill.value = r.skillText || ''
  if (section !== 2) {
    extra.value = r.extraText || ''
    links.value = [...(d.links || [])]
  }
}
// 完整度在这里按已保存的简历算（和服务端 KgResumeService 同一套规则）：基本信息 6 项各 10 分、技能描述满 20 字 25 分 / 不满 10 分、
// 有一段经历 15 分，合计 100。作品链接是可选项不计分——之前它占 10 分，没有作品的人（多数换工）最高只能到 90%
const missing = computed(() => {
  const r = data.value.resume || {}
  const out = []
  const basic = [['name', '昵称'], ['gender', '性别'], ['age', '年龄'], ['phone', '联系电话'], ['city', '所在城市'], ['intro', '自我介绍']]
    .filter(([k]) => r[k] == null || String(r[k]).trim() === '').map(([, label]) => label)
  if (basic.length) out.push({ text: '填写' + basic.join('、'), add: basic.length * 10, s: 2 })
  const sk = String(r.skillText || '').length
  if (!sk) out.push({ text: '写一段技能描述（20 字以上）', add: 25, s: 3 })
  else if (sk < 20) out.push({ text: `技能描述再多写几句（现在 ${sk} 字，满 20 字）`, add: 15, s: 3 })
  if (!(data.value.exps || []).length) out.push({ text: '补充一段经历', add: 15, s: 4 })
  return out
})
const goMissing = () => { if (missing.value.length) s.value = missing.value[0].s }
const score = computed(() => Math.max(0, 100 - missing.value.reduce((n, m) => n + m.add, 0)))
const pct = computed(() => score.value + '%')
const pctStyle = computed(() => `width: ${score.value}%`)
const basics = computed(() => [
  { label: '昵称', value: form.name || '未填写' },
  { label: '性别', value: form.gender || '未填写' },
  { label: '年龄', value: form.age || '未填写' },
  { label: '所在城市', value: form.city || '未填写' },
  { label: '自我介绍', value: form.intro || '未填写' }
])
const skillText = computed(() => skill.value || '还没写技能描述，点「编辑」补充，找机会时会按技能为你匹配。')
const STAT_STYLE = [
  { icon: 'heart', color: '#D9A08A', bg: '#F5E6E1' },
  { icon: 'briefcase', color: '#B8823C', bg: '#F4E8D2' },
  { icon: 'graduation-cap', color: '#40576B', bg: '#E7EDF1' }
]
const expStats = computed(() => (data.value.stats || []).map((x, i) => ({ ...x, ...STAT_STYLE[i] })))
const openExps = (i) => { tab.value = i; s.value = 4 }

// ---------------- s=2 ----------------
const savedHint = ref('填写后点「保存」生效')
async function reuse() {
  const scope = actionScope()
  if (!scope) return
  try {
    const res = await apiResumeReuse()
    if (!isCurrent(scope)) return
    readRevision++
    apply(res.data)
    toast(res.msg || '已复用')
  } catch (e) {
    if (isCurrent(scope)) toast(errText(e, '没有可复用的报名记录'))
  }
}
async function pickCity() {
  const scope = actionScope()
  if (!scope) return
  const value = await selectCity({ title: '所在城市', value: form.city })
  if (isCurrent(scope) && value !== null) form.city = value
}
// 保存要等服务端返回：连点会提交两次
const saving = ref(false)
let focusedSinceSubmit = false
const onDraftFocus = () => { if (saving.value) focusedSinceSubmit = true }
const savePayload = section => section === 3
  ? { skill: skill.value, extra: extra.value, links: [...links.value] }
  : { ...form, media: [...form.media], skill: skill.value }
async function save() {
  const scope = actionScope()
  if (!scope || resumeState.value !== 'ready' || saving.value || uploading.value || importing.value || expSaving.value) return
  const section = s.value, visit = editorVisit
  const payload = savePayload(section)
  const submitted = JSON.stringify(payload)
  readRevision++
  saving.value = true
  focusedSinceSubmit = false
  try {
    const res = section === 3 ? await apiResumeSkills(payload) : await apiResumeBasic(payload)
    if (!isCurrent(scope)) return
    readRevision++
    data.value = res.data
    loadOpp()
    if (visit !== editorVisit) return
    // 输入法的值可能晚于输入框的 focus 事件到达。
    if (focusedSinceSubmit || JSON.stringify(savePayload(section)) !== submitted) {
      toast('提交的内容已保存，继续编辑后请再保存')
      return
    }
    apply(res.data, section)
    savedHint.value = '已保存'
    toast(res.msg || '已保存')
    s.value = 1
  } catch (e) {
    if (isCurrent(scope)) toast(errText(e, '保存失败'))
  } finally {
    if (isCurrent(scope)) saving.value = false
  }
}
async function addLink() {
  const scope = actionScope()
  if (!scope) return
  if (links.value.length >= 10) return toast('最多 10 个链接')
  const v = await prompt('作品链接', { placeholder: 'https://…' })
  if (!isCurrent(scope)) return
  if (!v) return
  if (!/^https?:\/\//.test(v)) return toast('链接需以 http(s):// 开头')
  links.value.push(v)
}

// 上传内容保存到本人私有简历空间；识别结果只填入草稿，确认保存后才投递。
const importing = ref(false)
const uploading = ref(false)
const RESUME_VIDEO_MAX_MB = 200
async function importResume() {
  const scope = actionScope()
  if (!scope) return
  if (importing.value || saving.value) return
  importing.value = true
  const before = savePayload(2)
  try {
    const path = await chooseResumeDocument()
    if (!path || !isCurrent(scope)) return
    const result = (await uploadTo('/app/resume/import', path)).data || {}
    if (!isCurrent(scope)) return
    for (const key of ['name','gender','age','phone','city','intro','hobbies','personality','background']) {
      if (result.fields?.[key] && form[key] === before[key]) form[key] = String(result.fields[key])
    }
    if (result.fields?.skill && skill.value === before.skill) skill.value = result.fields.skill
    toast(result.message || '已识别，请核对后保存')
  } catch(e) { if (isCurrent(scope)) toast(errText(e, '识别失败，可继续手动填写')) }
  finally { if (isCurrent(scope)) importing.value = false }
}
async function addResumeMedia(kind) {
  const scope = actionScope()
  if (!scope) return
  if (uploading.value || saving.value) return
  if (kind !== 'portrait' && form.media.length >= 6) return toast('最多上传6个作品')
  uploading.value = true
  try {
    let path
    if (kind === 'video') {
      const video = await new Promise(resolve => uni.chooseVideo({ sourceType:['album','camera'], maxDuration:60, success:r=>resolve(r), fail:()=>resolve(null) }))
      // 与私有简历上传服务一致；文件先存私有目录，仍需签名和授权才能查看。
      if (!video || !isCurrent(scope)) return
      if (Number(video.size) > RESUME_VIDEO_MAX_MB * 1024 * 1024) return toast(`视频不能超过 ${RESUME_VIDEO_MAX_MB}MB，可以剪短一点或用手机压缩后再传`)
      path = video.tempFilePath
    } else path = await chooseImage()
    if (!path || !isCurrent(scope)) return
    const media = (await uploadTo('/app/resume/media', path, {kind})).data
    if (!isCurrent(scope)) return
    if (kind === 'portrait') { form.lifePhoto = media.key; form.lifePhotoUrl = media.url }
    else form.media.push(media)
  } catch(e) { if (isCurrent(scope)) toast(errText(e, '上传失败，请重试')) }
  finally { if (isCurrent(scope)) uploading.value = false }
}

// ---------------- s=4 经历 ----------------
const IMGS = '/static/media/cover-empty.png'
const byKind = (kinds) => (data.value.exps || []).filter(e => kinds.includes(e.kind)).map((e, i) => ({ ...e, img: IMGS, stars: e.stars || 0, comment: e.comment || (e.source === 'platform' ? '平台记录' : '自己填写') }))
const volunteer = computed(() => byKind(['volunteer']))
const parttime = computed(() => byKind(['parttime']))
const training = computed(() => byKind(['fulltime', 'training']))
const KIND = [['volunteer', '换工经历'], ['parttime', '兼职经历'], ['fulltime', '全职经历'], ['training', '培训经历']]
// 2026-11-03 主人：简化 —— 原来：新增 = 弹类型菜单 + 连弹「名称 / 门店 / 开始日期 / 结束日期（/ 考核等级）」4–5 个弹窗；
// 点卡片 = 先弹「修改 / 删除」菜单，修改再连弹一遍，删除再弹一次确认（最多 7 个弹窗）。
// 现在：底部一块小表单一次填完（类型按钮组、名称、门店 · 城市、起止日期用日期滚轮、培训才有考核等级），修改用同一块表单带入旧值，
// 删除是卡片右边的「×」+ 一次确认。日期不填就是「不填 / 至今」，和之前一样
const today = todayCn()
const expForm = reactive({ open: false, expId: 0, kind: 'volunteer', title: '', place: '', startDate: '', endDate: '', level: '' })
const expSaving = ref(false)
let expEditorVisit = 0
function openExpForm(e) {
  expEditorVisit++
  Object.assign(expForm, {
    open: true, expId: e.expId || 0, kind: KIND.some(k => k[0] === e.kind) ? e.kind : 'volunteer',
    title: e.title || '', place: e.place || '', startDate: e.startDate || '', endDate: e.endDate || '', level: e.level || ''
  })
}
// 「新增经历」：类型先按当前页签预选（换工 / 兼职 / 全职），表单里还能换
const addExp = () => openExpForm({ kind: ['volunteer', 'parttime', 'fulltime'][tab.value] || 'volunteer' })
// 平台自动记录的经历（已入职 / 已完成的岗位）不能改：卡片上写着「平台记录」，点了不动，也没有「×」
function editExp(e) { if (e.source !== 'platform') openExpForm(e) }
async function saveExp() {
  const scope = actionScope()
  if (!scope) return
  if (expSaving.value || saving.value) return
  const title = String(expForm.title || '').trim()
  if (!title) return toast('请填写岗位 / 课程名称')
  if ((expForm.startDate && !isYmd(expForm.startDate)) || (expForm.endDate && !isYmd(expForm.endDate))) return toast('日期格式应为 yyyy-MM-dd')
  if (expForm.startDate && expForm.endDate && expForm.endDate < expForm.startDate) return toast('结束日期不能早于开始日期')
  const body = { kind: expForm.kind, title, place: String(expForm.place || '').trim(), startDate: expForm.startDate, endDate: expForm.endDate, level: String(expForm.level || '').trim() }
  const editing = expForm.expId
  const visit = expEditorVisit
  expSaving.value = true
  try {
    const res = editing ? await apiResumeEditExp(editing, body) : await apiResumeAddExp(body)
    if (!isCurrent(scope)) return
    readRevision++
    data.value = res.data
    if (visit === expEditorVisit) expForm.open = false
    toast(res.msg || (editing ? '已保存' : '已添加'))
  } catch (e) {
    if (isCurrent(scope)) toast(errText(e, editing ? '保存失败' : '添加失败'))
  } finally {
    if (isCurrent(scope)) expSaving.value = false
  }
}
async function removeExp(e) {
  const scope = actionScope()
  if (!scope) return
  if (e.source === 'platform' || expSaving.value || saving.value) return
  if (!(await confirm('删除经历', `确认删除「${e.title}」？`))) return
  if (!isCurrent(scope) || expSaving.value || saving.value) return
  expSaving.value = true
  try {
    const response = await apiResumeRemoveExp(e.expId)
    if (!isCurrent(scope)) return
    readRevision++
    data.value = response.data
    if (expForm.expId === e.expId) expForm.open = false
    toast('已删除')
  } catch (err) {
    if (isCurrent(scope)) toast(errText(err, '删除失败'))
  } finally {
    if (isCurrent(scope)) expSaving.value = false
  }
}
// 切页签时收起表单（表单里的类型是按页签预选的）
watch(tab, () => { expForm.open = false })
const openCert = () => go(R.opportunities + '?s=4')
// 简历和上传文件属于本人；换账号立即清空草稿，旧回调不能写入新账号页面。
function syncAccountScope() {
  const next = captureScope()
  if (next.id === accountScope.id && next.revision === accountScope.revision) return false
  accountScope = next
  readRevision++; oppRevision++
  apply({ resume: {}, exps: [], stats: [], links: [], completeness: 0 })
  resumeState.value = next.id ? 'loading' : 'guest'
  opp.value = { jobs: [] }; oppLoaded.value = false; oppError.value = ''
  savedHint.value = '填写后点「保存」生效'
  saving.value = false; importing.value = false; uploading.value = false; expSaving.value = false
  Object.assign(expForm, { open: false, expId: 0, kind: 'volunteer', title: '', place: '', startDate: '', endDate: '', level: '' })
  if (ready && next.id && !disposed) load()
  return true
}
watch(() => [experience.account?.id, getSessionRevision()], syncAccountScope, { flush: 'sync' })
onShow(syncAccountScope)
onUnmounted(() => { disposed = true; readRevision++; oppRevision++ })
</script>

<style scoped lang="scss">
@import '../../styles/look.scss';
.nav-kefu { flex: none; display: flex; align-items: center; gap: 2px; width: auto; height: 44px; margin: 0; padding: 0 2px; background: transparent; color: var(--k-red-deep); font-size: 13px; line-height: 44px; }
.nav-kefu::after { border: 0; }
.b { display: block; }
.k-mt2 { margin-top: 2px; }
.k-mt6 { margin-top: 6px; }
.k-mt10 { margin-top: 10px; }
.k-mt14 { margin-top: 14px; }
.card { background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 14px; padding: 14px; }
.req { color: var(--k-red); margin-left: 3px; }

/* s1 */
.banner { display: flex; align-items: center; gap: 12px; padding: 12px 8px 12px 14px; background: var(--k-paper2); border: 1px solid var(--k-line); border-radius: 14px; }
.banner__text { flex: 1; min-width: 0; font-size: 14px; line-height: 1.7; color: var(--k-ink); }
.banner__img { width: 126px; height: 66px; flex: 0 0 auto; }
.pct { color: var(--k-green); font-family: var(--k-sans); font-weight: 700; font-size: 26px; line-height: 1; }
.sec { padding: 14px 0 12px; border-bottom: 1px solid var(--k-line); }
.kv { display: flex; align-items: flex-start; margin-top: 8px; font-size: 14px; }
.kv__label { width: 88px; flex: 0 0 auto; color: var(--k-muted); }
.kv__value { flex: 1; min-width: 0; line-height: 1.55; }
.skill { display: block; line-height: 1.75; }
.stat { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 14px 6px 12px; text-align: center; }
.stat__icon { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
.stat__title { font-size: 13px; color: var(--k-ink); white-space: nowrap; }
.stat__num { font-family: var(--k-sans); font-weight: 700; font-size: 24px; line-height: 1.1; }

/* s2 */
.saving { padding: 4px 0 12px; }
.saving__ok { width: 24px; height: 24px; }
.reuse { display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 14px; background: var(--k-paper2); border: 1px solid #E3CFA6; border-radius: 12px; }
.reuse__btn { height: 32px; padding: 0 12px; border: 1px solid var(--k-ochre); border-radius: 8px; background: var(--k-paper); color: #9A6A22; font-size: 14px; display: flex; align-items: center; }
.form { display: flex; flex-direction: column; gap: 16px; }
.form__row { display: flex; align-items: center; gap: 12px; }
.form__label { width: 80px; flex: 0 0 auto; font-size: 15px; color: var(--k-ink); display: flex; align-items: center; }
.form__label--lg { width: auto; font-family: var(--k-display-font); font-weight: 700; font-size: 16px; }
.form__hint { font-family: var(--k-sans); font-weight: 400; font-size: 14px; }
.form__input { flex: 1; min-height: 42px; }
.form__input input { height: 40px; }
.gender { min-width: 52px; height: 40px; padding: 0 14px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; font-size: 15px; }
.gender.on { background: var(--k-red); border-color: var(--k-red); color: var(--k-paper); }
.area { border: 1px solid var(--k-line2); border-radius: 10px; background: var(--k-paper); padding: 12px; }
.area textarea, .area .resume-area-idle { width: 100%; height: 104px; font-size: 15px; line-height: 1.7; }
.area--tall textarea, .area--tall .resume-area-idle { height: 122px; }
.area--mid textarea, .area--mid .resume-area-idle { height: 108px; }
/* 不打字时的文字预览：和输入框一样大，自动换行，超出部分截掉 */
.resume-area-idle { white-space: pre-wrap; word-break: break-all; overflow: hidden; }

/* s3 */
.tip { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; background: var(--k-indigo-soft); border: 1px solid #C4D0D8; border-radius: 12px; }
.tip__icon { width: 22px; height: 22px; border-radius: 50%; background: var(--k-indigo); color: var(--k-paper); font-family: var(--k-sans); font-weight: 700; font-size: 14px; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; margin-top: 1px; }
.tip__text { flex: 1; font-size: 14px; line-height: 1.7; color: var(--k-indigo); }
.link { min-height: 42px; gap: 8px; }
.link__url { flex: 1; min-width: 0; font-size: 14px; }
.addlink { height: 42px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 15px; }

/* s4 */
.tabs { display: flex; align-items: center; padding: 0 8px; margin-top: 2px; }
.tabs__item { flex: 1; text-align: center; padding: 10px 0 12px; font-size: 15px; color: var(--k-ink); position: relative; }
.tabs__item.active { font-family: var(--k-display-font); font-weight: 700; }
.tabs__item.active::after { content: ""; position: absolute; left: 50%; bottom: 0; width: 72px; height: 3px; margin-left: -36px; background: var(--k-red); border-radius: 2px; }
.exp { display: flex; align-items: center; gap: 12px; padding: 12px 8px 12px 12px; }
.exp__img { width: 88px; height: 104px; border-radius: 8px; flex: 0 0 auto; }
.exp__img--short { height: 88px; }
.exp__title { font-family: var(--k-display-font); font-weight: 700; font-size: 16px; line-height: 1.35; }
/* 2026-11-03 主人：简化 —— 经历卡右边的「×」（44px 可点区）和底部一次填完的小表单 */
.exp__x { flex: 0 0 auto; width: 44px; height: 44px; margin: -8px -10px -8px -6px; display: flex; align-items: center; justify-content: center; }
.exp-form { display: flex; flex-direction: column; gap: 12px; }
.exp-form__title { font-family: var(--k-display-font); font-weight: 700; font-size: 17px; }
.exp-form__row { display: flex; align-items: center; gap: 10px; }
.exp-form__row--top { align-items: flex-start; }
.exp-form__label { flex: 0 0 76px; font-size: 15px; color: var(--k-ink); line-height: 42px; }
.exp-form__input { flex: 1; min-width: 0; }
.exp-form__pick { min-height: 44px; justify-content: space-between; }
.exp-form__clear { flex: 0 0 auto; width: 36px; height: 44px; display: flex; align-items: center; justify-content: center; }
.exp-form__pills { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.exp-form__pill { min-height: 44px; padding: 0 14px; border: 1px solid var(--k-line2); border-radius: 999px; background: var(--k-paper); font-size: 14px; display: flex; align-items: center; }
.exp-form__pill.on { border-color: #C9935F; background: #F6EBDD; color: #8A5A30; font-weight: 600; }
.exp-form__btns { display: flex; gap: 10px; margin-top: 4px; }
.exp-form__btn { flex: 1; min-width: 0; }
.stars { display: flex; gap: 1px; }
.star { position: relative; width: 14px; height: 14px; }
.star__half { position: absolute; left: 0; top: 0; }
.missing { display: flex; flex-direction: column; gap: 6px; padding-top: 8px; border-top: 1px dashed var(--k-line); }
.missing__item { display: flex; align-items: center; gap: 6px; font-size: 13px; min-height: 26px; }
.missing__dot { color: #9A6A22; font-weight: 700; }
.missing__text { flex: 1; min-width: 0; }
.missing__add { flex: 0 0 auto; color: var(--k-green); font-weight: 600; }
.skill-hint { display: block; margin-top: 6px; }
/* s1 下半部分：技能匹配机会（10-18）——分区标题 17px 粗，标签是浅暖色等高胶囊，机会是白卡左图右文 */
.opp { margin-top: 22px; padding-top: 16px; border-top: 1px dashed var(--k-line2); }
.opp__head { display: flex; align-items: center; justify-content: space-between; min-height: 32px; }
.opp__title { font-size: 17px; font-weight: 700; color: var(--k-ink); }
.opp__more { display: flex; align-items: center; gap: 2px; min-height: 44px; margin: -6px -4px -6px 0; padding: 0 4px 0 10px; font-size: 13px; color: var(--k-muted); }
.opp__tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.opp__tag { height: 28px; padding: 0 12px; border-radius: 14px; background: #F6EBDD; color: var(--k-red-deep); font-size: 13px; line-height: 28px; }
.oppc { display: flex; gap: 12px; margin-top: 10px; padding: 10px; border: 0; border-radius: 16px; box-shadow: var(--k-sh1); }
.oppc__img { width: 84px; height: 84px; border-radius: 12px; flex: 0 0 auto; background: var(--k-paper2); }
.oppc__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.oppc__top { display: flex; align-items: flex-start; gap: 8px; }
.oppc__name { flex: 1; min-width: 0; font-size: 15px; font-weight: 700; line-height: 1.4; color: var(--k-ink); overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.oppc__match { flex: 0 0 auto; height: 22px; padding: 0 8px; border-radius: 11px; background: var(--k-green-soft); color: var(--k-green); font-size: 12px; font-weight: 600; line-height: 22px; }
.oppc__meta { font-size: 12px; color: var(--k-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.oppc__why { font-size: 12px; color: var(--k-green); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.opp__empty { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 10px; padding: 20px 14px; text-align: center; border: 0; border-radius: 16px; box-shadow: var(--k-sh1); }
/* ---------------------------------------------------------------------------------------------------------------
   2026-10-19 一比一还原（全局视觉语言）：暖米渐变页面底、白卡圆角 20 + 柔阴影 + 细边、标题用标题字体（700 / 900）、主按钮暖棕渐变。只改样式
   --------------------------------------------------------------------------------------------------------------- */
.resume { --k-bg: #{$look-bg-top}; background: $look-bg; }
.card { border-radius: 20px; border: $look-hairline; box-shadow: $look-shadow; }
.banner { border-radius: 20px; border: 0; background: linear-gradient(125deg, #FDF4E8 0%, #F6E4CD 100%); box-shadow: $look-shadow-sm; }
.stat__num { font-family: var(--k-display-font); font-weight: 900; }
.tabs__item.active { color: $look-chip-on-ink; }
.tabs__item.active::after { width: 28px; height: 4px; margin-left: -14px; background: $look-grad-brown; }
.exp__img { border-radius: 12px; }
.opp { border-top-color: rgba(201, 147, 95, .35); }
.opp__title { font-family: var(--k-display-font); font-size: 18px; font-weight: 700; }
.oppc { padding: 12px; border-radius: 20px; border: $look-hairline; box-shadow: $look-shadow; }
.oppc__img { border-radius: 14px; }
.oppc__img--empty { display: flex; align-items: center; justify-content: center; background: linear-gradient(145deg, #FBF1E4 0%, #F3E1C8 100%); }
.oppc__name { font-family: var(--k-display-font); font-weight: 700; }
.oppc__match { background: $look-green-soft; color: $look-green; font-weight: 700; }
.opp__empty { border-radius: 20px; border: $look-hairline; box-shadow: $look-shadow; }
@import './resume-refined.scss';
</style>
