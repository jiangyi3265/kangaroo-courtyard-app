<template>
  <view class="k-page" :class="$userSurface">
    <k-topbar title="草稿箱" back />
    <view class="k-body drafts-body">
      <!-- 11-18 第三轮：没有草稿时是一张像样的空状态卡（56 浅棕方块 + 32 号线性图标、14 / 500 标题、12 灰字说明）；
           「本机保存 N/10 份…」这句挪到列表下面做页脚。每份草稿：类型小标签 + 时间同一行，标题 15 / 600，摘要两行，底下按钮靠右 -->
      <view v-if="!rows.length" class="draft-empty"><view class="draft-empty__ico"><k-icon name="file-pen" :size="32" color="red" /></view><text class="draft-empty__title">还没有草稿。</text><text class="draft-empty__text">在发布页点「保存草稿」，下次从这里继续。</text></view>
      <view v-for="row in rows" :key="row.id" class="draft-row">
        <text class="draft-kind">{{ row.kind === 'wish' ? '心愿互助' : row.label }}</text>
        <text class="draft-title" :class="{ 'draft-title--empty': !row.data.title }">{{ row.data.title || '未命名草稿' }}</text>
        <text class="draft-preview">{{ row.data.body || row.data.description || '已保存图片与其他信息' }}</text>
        <view class="draft-actions"><text>{{ date(row.updatedAt) }}</text><button @click="remove(row)">删除</button><button v-if="row.kind === 'wish' ? wishEnabled : communityEnabled" class="draft-continue" @click="edit(row)">继续编辑</button></view>
      </view>
      <text class="draft-hint">本机保存 {{ rows.length }}/10 份，按账号分开；发布成功后移除对应草稿。</text>
    </view>
  </view>
</template>
<script setup>
import { wishEnabled, communityEnabled } from '@/common/features.js'
import { ref, watch } from 'vue'
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
watch(() => experience.account?.id, () => {
  rows.value = []
  load()
}, { flush: 'sync' })
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
/* 2026-11-17 改版「小而精」（主人按样张第三版拍板）：浅灰底，每份草稿一张白卡（12 圆角、不描边），类型做成小标签，按钮收成小胶囊（看着 30 高，四周留 3 的透明边，点按高度 36）。功能和文字不变：删除、继续编辑都在 */
.k-page{--k-bg:var(--k-page);background:var(--k-page)}
.k-page :deep(.k-navbar__title){font-family:var(--k-sans);font-size:16px;font-weight:600}
.drafts-body{padding-top:8px;padding-left:12px;padding-right:12px;padding-bottom:calc(24px + var(--k-safe-bottom))}
.draft-hint{padding:0 2px;font-size:12px}
/* 11-18 第二轮：没有草稿时是一张白卡空状态（居中、12 灰字）；「继续编辑」改成浅底小按钮，看着 28 高，四周 4 的透明边，点按高度仍 36 */
.draft-empty{margin-top:8px;padding:28px 12px;border-radius:12px;background:var(--k-paper);font-size:12px;line-height:1.6;text-align:center}
.draft-row{margin-top:8px;padding:12px;border-bottom:0;border-radius:12px;background:var(--k-paper)}
.draft-kind{display:inline-block;padding:0 6px;border-radius:4px;background:var(--k-red-soft);color:var(--k-red-deep);font-size:11px;font-weight:500;line-height:18px}
.draft-title{margin:6px 0 2px;font-size:14px;line-height:20px}
.draft-preview{font-size:12px}
.draft-actions{gap:0;margin:6px -4px -4px 0;font-size:11px}
.draft-actions button{padding:0 12px;border:4px solid transparent;border-radius:18px;background:var(--k-fill) padding-box;color:var(--k-ink2);font-size:12px;line-height:28px}
.draft-actions .draft-continue{background:var(--k-red-soft) padding-box;color:var(--k-red-deep);font-weight:500}
/* 11-18 第三轮：页边距 16；空状态卡（白卡居中，上 32 下 28）；草稿卡内边距 12–16、标题 15 / 600、摘要 13 二级墨两行；底部一行时间 11 灰字 + 两个 28 高小按钮；页脚说明 11 灰字居中 */
.drafts-body{padding-left:16px;padding-right:16px}
.draft-empty{display:flex;flex-direction:column;align-items:center;padding:32px 16px 28px}
.draft-empty__ico{display:flex;align-items:center;justify-content:center;width:56px;height:56px;margin-bottom:12px;border-radius:16px;background:var(--k-red-soft)}
.draft-empty__title{font-size:14px;font-weight:500;line-height:20px;color:var(--k-ink2)}
.draft-empty__text{margin-top:4px;font-size:12px;line-height:1.6;color:var(--k-muted)}
.draft-row{padding:14px 12px 12px}
.draft-title{margin:8px 0 4px;font-size:15px;font-weight:600;line-height:21px;color:var(--k-ink)}
.draft-preview{font-size:13px;line-height:1.6;color:var(--k-ink2)}
.draft-actions{margin-top:10px}
.draft-actions text{font-size:11px;color:var(--k-muted)}
.draft-hint{display:block;margin-top:16px;padding:0 16px;font-size:11px;line-height:1.6;text-align:center;color:var(--k-muted)}
/* 11-18 第三轮返修：「删除」退成 12 号灰字文字按钮（不再和「继续编辑」一样大一样重），「继续编辑」32 高浅棕胶囊；
   没有草稿时空状态不装白卡，整块放在内容区三成高度；页脚说明最宽 264 居中，320 宽不把「对应」拆开 */
.draft-actions{margin:10px 0 0;gap:4px}
.draft-actions button{height:32px;min-height:32px;margin:0;padding:0 8px;border:0;border-radius:16px;background:transparent;color:var(--k-muted);font-size:12px;font-weight:400;line-height:32px}
.draft-actions button::after{border:0}
.draft-actions .draft-continue{padding:0 14px;background:var(--k-red-soft);color:var(--k-red-deep);font-size:13px;font-weight:500}
.draft-empty{margin-top:80px;padding:0 16px;background:transparent}
.draft-hint{max-width:264px;margin-left:auto;margin-right:auto;padding:0;word-break:keep-all;text-wrap:balance}
.draft-kind{font-size:11px}
/* 11-18 返修（第 2 轮）：空状态装回 12 圆角白卡（上下 24、左右 16），和积分商城、钱包、关注页的空状态一个写法；
   页脚说明在卡下面 12，不再限宽强行断行：390 宽一行放下，窄屏按整句均衡折行 */
.draft-empty{margin-top:0;padding:24px 16px;border-radius:12px;background:var(--k-paper)}
.draft-hint{max-width:none;margin-top:12px;padding:0 8px;word-break:normal;text-wrap:balance}
/* 11-18 第三轮返修（第 3 轮）：有草稿、没草稿两种状态离顶栏一样（第一张卡上沿 12）；没写标题时的「未命名草稿」用灰色 500，一看就是系统补的 */
.drafts-body{padding-top:12px}
.draft-empty,.draft-row:first-child{margin-top:0}
.draft-title--empty{font-weight:500;color:var(--k-muted)}
/* 11-18 第三轮返修（第 5 轮）：页脚说明只在空格、标点处折行：390 宽一行，320 宽在「；」后折成两行，不再把「分开」拆成两行 */
.draft-hint{word-break:keep-all;text-wrap:wrap}
/* 11-18 第四轮（全端统一：整页只剩一个空状态时不套卡）：空状态直接放在浅灰底上、下移到屏高约 1/4（离顶栏 96），
   56 浅棕方块 + 32 号图标 → 标题 14 / 500 墨色 → 12 灰字说明（最宽 260）→ 24 → 页脚说明；有草稿时不受影响 */
.draft-empty{margin-top:84px;padding:0 16px;border-radius:0;background:transparent}
.draft-empty__title{color:var(--k-ink)}
.draft-empty__text{max-width:260px}
.draft-empty+.draft-hint{margin-top:24px}
/* 11-19 微信实拍返修：空状态整块下移到约 38% 屏高（离顶栏 160），「本机保存…」紧跟在说明下面 16、12 号、浅一档（--k-light），和空状态合成一块，不再两段字各自漂着 */
.draft-empty{margin-top:160px}
.draft-empty+.draft-hint{margin-top:16px;font-size:12px;color:var(--k-light)}
</style>
