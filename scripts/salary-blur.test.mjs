import assert from 'node:assert/strict'
import test from 'node:test'
import {readFile} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {createRequire} from 'node:module'
import {resolve, dirname, join} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

const here=dirname(fileURLToPath(import.meta.url))
let root=here
while(!existsSync(join(root,'acceptance/supplemental/salary_real.py'))){
  const parent=dirname(root);assert.notEqual(parent,root,'Workspace not found');root=parent
}
const app=join(root,'袋鼠旅游2')
const require=createRequire(join(app,'package.json'))
const {parse,compileScript}=require('@vue/compiler-sfc')
const {reactive}=require('vue')
const component=process.env.KG_SALARY_COMPONENT_FILE||join(app,'components/k-job-salary/k-job-salary.vue')
const source=await readFile(component,'utf8')
const common=await readFile(join(app,'common/job-salary.js'),'utf8')
const commonUrl='data:text/javascript;base64,'+Buffer.from(common).toString('base64')
const {salaryPayload,validateSalaryForm}=await import(commonUrl)
const {descriptor,errors}=parse(source,{filename:'k-job-salary.vue',templateParseOptions:{isCustomElement:()=>true}})
assert.deepEqual(errors,[])
const compiled=compileScript(descriptor,{id:'salary-blur-regression',inlineTemplate:true,
  templateOptions:{compilerOptions:{isCustomElement:()=>true}}}).content
  .replaceAll('from "vue"','from '+JSON.stringify(pathToFileURL(join(app,'node_modules/vue/index.mjs')).href))
  .replaceAll("from 'vue'",'from '+JSON.stringify(pathToFileURL(join(app,'node_modules/vue/index.mjs')).href))
  .replaceAll("from '@/common/job-salary.js'",'from '+JSON.stringify(commonUrl))
const definition=(await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'))).default

function controls(model){
  const props=reactive({modelValue:{...model}}), emissions=[]
  const render=definition.setup(props,{expose(){},emit(name,value){assert.equal(name,'update:modelValue');emissions.push({...value});props.modelValue=value}})
  const locate=id=>{
    function find(node){
      if(!node||typeof node!=='object')return null
      if(node.props?.id===id)return node
      for(const child of Array.isArray(node.children)?node.children:[]){const found=find(child);if(found)return found}
      return null
    }
    let node=find(render({},[]))
    // 说明框平时只显示一块「点一下才编辑」的预览（防止原生 textarea 盖住底部按钮），先像用户一样点一下再找输入框
    if(!node){const idle=render({},[]);const preview=(function walk(n){if(!n||typeof n!=='object')return null;if(n.props?.id===id+'-idle')return n;for(const c of Array.isArray(n.children)?n.children:[]){const f=walk(c);if(f)return f}return null})(idle);if(preview)preview.props.onClick();node=find(render({},[]))}
    assert(node,'Rendered input '+id);return node.props
  }
  return {props,emissions,locate}
}
const initial={pay:'salary',salaryType:'monthly',salary:'6000',bonusEnabled:true,bonusDesc:'首筆奖金',commissionEnabled:true,commissionDesc:'首笔提成'}
for(const [id,key,first,final]of [['job-base-salary','salary','6100','6500'],['job-bonus-rule','bonusDesc','首笔奖金','最终奖金500元'],['job-commission-rule','commissionDesc','首笔提成','最终提成8%']]){
  test(key+': actual compiled blur event commits final native value without waiting for throttled input',()=>{
    const {props,locate}=controls(initial)
    locate(id).onInput({detail:{value:first}})
    // The second native input is withheld by uni's throttle; its ordinary blur
    // must carry and commit the final value before publication reads the model.
    locate(id).onBlur?.({detail:{value:final}})
    const expected={...initial,[key]:final}
    assert.deepEqual({...props.modelValue},expected)
    assert.equal(validateSalaryForm(props.modelValue),'')
    assert.deepEqual(salaryPayload(props.modelValue),salaryPayload(expected))
    // A later throttle flush carrying the same final value must not lose data.
    locate(id).onInput({detail:{value:final}})
    assert.deepEqual({...props.modelValue},expected)
  })
  test(key+': ordinary single input and blur preserve all other fields',()=>{
    const {props,locate}=controls(initial)
    locate(id).onInput({detail:{value:final}})
    locate(id).onBlur?.({detail:{value:final}})
    assert.deepEqual({...props.modelValue},{...initial,[key]:final})
  })
}
