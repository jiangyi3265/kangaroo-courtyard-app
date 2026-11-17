<template>
  <view class="k-page">
    <k-topbar title="草稿箱" back />
    <view class="k-body drafts-body">
      <text class="draft-hint">本机保存 {{ rows.length }}/10 份，按账号分开；发布成功后移除对应草稿。</text>
      <view v-if="!rows.length" class="draft-empty">还没有草稿。在发布页点「保存草稿」，下次从这里继续。</view>
      <view v-for="row in rows" :key="row.id" class="draft-row">
        <text class="draft-kind">{{ row.kind === 'wish' ? '心愿互助' : row.label }}</text>
        <text class="draft-title">{{ row.data.title || '未命名草稿' }}</text>
        <text class="draft-preview">{{ row.data.body || row.data.description || '已保存图片与其他信息' }}</text>
        <view class="draft-actions"><text>{{ date(row.updatedAt) }}</text><button @click="remove(row)">删除</button><button v-if="row.kind === 'wish' ? wishEnabled : communityEnabled" class="draft-continue" @click="edit(row)">继续编辑</button></view>
      </view>
    </view>
  </view>
</template>
<script setup>
import { wishEnabled, communityEnabled } from '@/common/features.js'
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { ensureSession, experience } from '@/common/experience.js'
import { listDrafts, removeLocalDraft, migrateLocalDrafts } from '@/common/local-drafts.js'
import { confirm } from '@/common/ui.js'
import { go, toast } from '@/common/screen.js'
const rows = ref([])
async function load() {
  await ensureSession()
  if (!experience.account?.id) return
  try { migrateLocalDrafts(experience.account.id); rows.value = listDrafts(experience.account.id) }
  catch (e) { toast(e.message || '草稿读取失败') }
}
onShow(load)
const date = value => { const d = new Date(value); return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }
const edit = row => go(`/pages/${row.kind === 'wish' ? 'wish' : 'community'}/publish?draftId=${encodeURIComponent(row.id)}`)
async function remove(row) {
  const user = experience.account?.id
  if (!await confirm('删除草稿', '删除后无法恢复，确定删除这份草稿？') || user !== experience.account?.id) return
  try { removeLocalDraft(user, row.id); await load() } catch (e) { toast(e.message || '删除失败') }
}
</script>
<style scoped>
.drafts-body{padding-top:20px}.draft-hint,.draft-preview{display:block;color:var(--k-muted);font-size:13px;line-height:1.6}.draft-empty{padding:70px 12px;color:var(--k-muted);line-height:1.8;text-align:center}.draft-row{padding:22px 0;border-bottom:1px solid var(--k-line)}.draft-kind{font-size:12px;color:var(--k-red)}.draft-title{display:block;font-size:19px;font-weight:600;margin:8px 0}.draft-preview{overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.draft-actions{display:flex;align-items:center;gap:12px;margin-top:16px;font-size:12px;color:var(--k-muted)}.draft-actions text{flex:1}.draft-actions button{margin:0;padding:7px 12px;line-height:1.6;font-size:13px;background:var(--k-paper2);color:var(--k-ink);border-radius:20px}.draft-actions button:after{border:0}.draft-actions .draft-continue{background:var(--k-red);color:var(--k-paper)}
</style>
