import type{Meta,StoryObj}from'@storybook/react-vite'
import{SystemHealthClient}from'./SystemHealthClient'
const meta={title:'Pages/System Health',component:SystemHealthClient,args:{healthScore:98,alerts:[],heartbeats:[{worker:'classification',instance_id:'worker-1',last_beat_at:new Date().toISOString(),jobs_done_window:120,jobs_failed_window:0,backlog_seen:2,p95_latency_ms:'180',state:'running'}],workers:[{worker:'classification',desired:true,waiting:2,delayed:0,active:1,failed:0}],canaries:[],capabilities:[],killSwitchEnabled:false}}satisfies Meta<typeof SystemHealthClient>
export default meta
export const Default:StoryObj<typeof meta>={}
