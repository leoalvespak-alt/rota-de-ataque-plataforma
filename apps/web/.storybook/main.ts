import type { StorybookConfig } from '@storybook/react-vite'
import react from '@vitejs/plugin-react'
import { mergeConfig } from 'vite'
const config:StorybookConfig={stories:['../src/**/*.stories.@(ts|tsx)'],framework:{name:'@storybook/react-vite',options:{}},addons:[],viteFinal:async(config)=>mergeConfig(config,{plugins:[react()]})}
export default config
