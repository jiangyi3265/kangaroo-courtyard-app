<template><view><view v-for="(f,i) in files" :key="f.fileId" class="evidence-line" hover-class="k-press-s" @click="open(f)"><k-icon name="file-text" :size="16" color="muted"/><text>{{ anonymous?'脱敏材料 '+(i+1):(f.originalName||'附件 '+(i+1)) }}</text><text>查看</text><k-icon name="chevron-right" :size="12" color="red"/></view><video v-if="media&&media.mime.startsWith('video/')" :src="media.url" controls :show-fullscreen-btn="true" style="width:100%;height:200px"/><text v-if="error" class="error">{{ error }}</text></view></template>
<script setup>
import {ref,onUnmounted} from 'vue'
import {evidenceLink} from '@/common/governance.js'
defineProps({files:{type:Array,default:()=>[]},anonymous:Boolean})
const media=ref(null),error=ref('');let audio,active=true,request=0
async function open(f){if(!active)return;const current=++request;error.value='';try{const result=await evidenceLink(f.fileId);if(!active||current!==request)return;if(result.mime.startsWith('image/'))uni.previewImage({urls:[result.url]});else if(result.mime.startsWith('video/'))media.value=result;else if(result.mime.startsWith('audio/')){if(audio)audio.destroy();audio=uni.createInnerAudioContext();audio.src=result.url;audio.onError(()=>{if(active&&current===request)error.value='音频播放失败，请重新打开'});audio.play()}else{
// #ifdef H5
window.open(result.url,'_blank','noopener')
// #endif
// #ifdef MP-WEIXIN
uni.downloadFile({url:result.url,success:r=>{if(!active||current!==request)return;if(r.statusCode!==200){error.value='下载失败，请重试';return}uni.openDocument({filePath:r.tempFilePath,showMenu:true,fail:()=>{if(active&&current===request)error.value='此文件可下载，但当前设备不支持预览'}})},fail:()=>{if(active&&current===request)error.value='下载失败，请重试'}})
// #endif
}}catch(e){if(active&&current===request)error.value=e.message||'无法打开证据'}}
onUnmounted(()=>{active=false;request++;audio?.destroy()})
</script>
<style scoped>/* 2026-11-17 改版「小而精」：附件行 44 高、细线分开，「查看」用小号棕字 */
.evidence-line{position:relative;display:flex;align-items:center;gap:8px;min-height:44px;font-size:13px}.evidence-line::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:var(--k-line);transform:scaleY(.5)}.evidence-line:last-of-type::after{display:none}.evidence-line text:last-of-type{margin-right:-6px}.evidence-line text:first-of-type{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.evidence-line text:last-of-type{color:var(--k-red-deep);font-size:12px}.error{color:var(--k-alert);font-size:12px}</style>
