'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { appPath } from '@/lib/base-path'
export default function Login(){const[email,setEmail]=useState('');const[otp,setOtp]=useState('');return <main className="page"><form className="card" onSubmit={(event)=>{event.preventDefault();void signIn('credentials',{email,otp,callbackUrl:appPath('/')})}}><h1>Entrar</h1><label>Email<input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required/></label><button type="button" onClick={()=>void fetch(appPath('/api/auth/otp'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email})})}>Enviar código</button><label>Código<input inputMode="numeric" value={otp} onChange={(e)=>setOtp(e.target.value)} required/></label><button type="submit">Entrar</button></form></main>}
