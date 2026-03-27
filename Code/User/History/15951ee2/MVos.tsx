import { useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Box, Text, Anchor, Stack } from '@mantine/core'
import { TbTruck, TbShieldCheck, TbHeartHandshake, TbArrowRight, TbLock } from 'react-icons/tb'
import styled, { keyframes } from 'styled-components'
import AppLogo from '../../components/AppLogo'
import { CountryPhoneInput, type PhoneValue } from '../../components/CountryPhoneInput'
import { useLoginForm } from '../../../features/auth/login-form/model/useLoginForm'

const fadeUp = keyframes`from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}`
const float  = keyframes`0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}`
const pulse  = keyframes`0%,100%{opacity:0.4;transform:scale(1)}50%{opacity:0.7;transform:scale(1.05)}`

const Page = styled.div`min-height:100vh;display:grid;grid-template-columns:440px 1fr;@media(max-width:800px){display:block;}`
const BrandPanel = styled.div`
  background:linear-gradient(170deg,#011a4a 0%,#012970 40%,#0d5fa4 75%,#15B3E0 100%);
  padding:3rem 2.5rem;display:flex;flex-direction:column;justify-content:center;
  position:relative;overflow:hidden;@media(max-width:800px){display:none;}
`
const BrandOrb = styled.div<{$size:number;$top:string;$left:string;$delay?:string}>`
  position:absolute;width:${p=>p.$size}px;height:${p=>p.$size}px;border-radius:50%;
  background:radial-gradient(circle,rgba(21,179,224,0.18) 0%,rgba(21,179,224,0) 70%);
  top:${p=>p.$top};left:${p=>p.$left};
  animation:${pulse} ${p=>p.$delay?'5s':'7s'} ease-in-out infinite ${p=>p.$delay||'0s'};
`
const FeatureRow = styled.div`display:flex;align-items:flex-start;gap:14px;margin-bottom:20px;`
const FeatureIcon = styled.div`width:38px;height:38px;border-radius:10px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;`
const PortalLink = styled(Link)`display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:10px;text-decoration:none;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.18);transition:background 0.15s;&:hover{background:rgba(255,255,255,0.18);}`
const FormPanel = styled.div`
  background:#F0F4FA;display:flex;align-items:center;justify-content:center;
  padding:2rem 1.5rem;position:relative;overflow:hidden;
  &::before{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(1,41,112,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(1,41,112,0.04) 1px,transparent 1px);background-size:32px 32px;pointer-events:none;}
  @media(max-width:800px){min-height:60vh;padding:0;display:flex;flex-direction:column;justify-content:flex-start;
    background:linear-gradient(165deg,#011a4a 0%,#012970 35%,#0d5fa4 60%,#15B3E0 100%);&::before{display:none;}}
`
const MobileHero = styled.div<{$lifted?:boolean}>`
  display:none;
  @media(max-width:800px){display:${p=>p.$lifted?'none':'flex'};flex-direction:column;align-items:center;position:relative;text-align:center;flex-shrink:0;
    padding:1rem 1.5rem 1.25rem;}
`
const MobileHeroOrb = styled.div<{$size:number;$top:string;$left:string}>`position:absolute;width:${p=>p.$size}px;height:${p=>p.$size}px;border-radius:50%;background:rgba(255,255,255,0.06);top:${p=>p.$top};left:${p=>p.$left};pointer-events:none;`
const PillIcon = styled.div`width:64px;height:64px;border-radius:20px;background:rgba(255,255,255,0.18);border:1.5px solid rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;margin-bottom:10px;animation:${float} 4s ease-in-out infinite;box-shadow:0 8px 32px rgba(0,0,0,0.2);`
const Card = styled.div<{$lifted?:boolean}>`
  width:100%;max-width:420px;background:#fff;border-radius:20px;
  padding:2.75rem 2.25rem;box-shadow:0 8px 40px rgba(1,41,112,0.13);
  border:1px solid #EDF0F7;animation:${fadeUp} 0.5s ease both;position:relative;z-index:2;
  @media(max-width:800px){max-width:100%;border:none;padding:1.75rem 1.5rem 1.75rem;
    box-shadow:0 -4px 40px rgba(0,0,0,0.18);border-radius:28px 28px 0 0;flex:1;
    ${p=>p.$lifted?`position:fixed;top:0;left:0;right:0;bottom:0;border-radius:0;overflow-y:auto;padding:2.5rem 1.5rem 3rem;z-index:500;box-shadow:none;-webkit-overflow-scrolling:touch;`:''}}
`
const PwdInput = styled.div`
  .mantine-PasswordInput-input,.mantine-PasswordInput-innerInput{height:48px;border:1.5px solid #E4E9F0;border-radius:12px;font-family:'DM Sans',sans-serif;font-size:14px;color:#1A2B3C;background:#FAFBFD;&:focus{border-color:#15B3E0;box-shadow:0 0 0 3px rgba(21,179,224,0.12);&::placeholder{color:#B0BBC8;}}}
  .mantine-PasswordInput-label{font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;color:#2D3A4A;margin-bottom:6px;}
  .mantine-Input-section{color:#9EADB8;}
`
const PrimaryBtn = styled.button`width:100%;height:50px;background:linear-gradient(135deg,#15B3E0 0%,#012970 100%);border:none;border-radius:12px;color:#fff;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:opacity 0.2s,transform 0.15s;box-shadow:0 4px 18px rgba(21,179,224,0.35);&:hover:not(:disabled){opacity:0.92;transform:translateY(-1px);}&:disabled{opacity:0.55;cursor:not-allowed;box-shadow:none;}`

const features = [
  { Icon: TbTruck,          title: 'Fast Delivery',      desc: 'Medicines at your door in hours' },
  { Icon: TbShieldCheck,    title: 'Insurance Support',  desc: 'Direct billing, zero paperwork' },
  { Icon: TbHeartHandshake, title: '24/7 Pharmacy Chat', desc: 'Licensed pharmacists always on call' },
]

export default function Login(): JSX.Element {
  const { loading, onSubmit } = useLoginForm()
  const [phone, setPhone] = useState<PhoneValue>({ countryCode: '+256', number: '' })
  const [password, setPassword] = useState('')
  const [lifted, setLifted] = useState(false)
  const handleFocusIn  = useCallback(() => setLifted(true),  [])
  const handleFocusOut = useCallback(() => setLifted(false), [])

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSubmit(phone, password) }

  const formContent = (
    <>
      <Box mb={28}>
        <Text style={{ fontFamily:"'DM Sans',sans-serif",fontWeight:800,fontSize:26,color:'#1A2B3C',marginBottom:6,letterSpacing:'-0.3px' }}>Welcome back</Text>
        <Text style={{ fontFamily:"'DM Sans',sans-serif",fontSize:14,color:'#8A96A3' }}>Sign in with your phone number and password</Text>
      </Box>
      <form onSubmit={handleSubmit}>
        <Stack gap={16}>
          <CountryPhoneInput label="Phone Number" value={phone} onChange={setPhone} required placeholder="700 123 456"/>
          <PwdInput>
            <p style={{ fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600,color:'#2D3A4A',margin:'0 0 6px' }}>Password</p>
            <div style={{ position:'relative' }}>
              <TbLock size={15} color="#9EADB8" style={{ position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',zIndex:1 }}/>
              <input
                type="password" value={password} onChange={e=>setPassword(e.target.value)}
                placeholder="Enter your password" required
                style={{ width:'100%',height:48,border:'1.5px solid #E4E9F0',borderRadius:12,fontFamily:"'DM Sans',sans-serif",fontSize:14,color:'#1A2B3C',background:'#FAFBFD',paddingLeft:38,paddingRight:14,outline:'none',boxSizing:'border-box' }}
                onFocus={e=>{e.target.style.borderColor='#15B3E0';e.target.style.boxShadow='0 0 0 3px rgba(21,179,224,0.12)'}}
                onBlur={e=>{e.target.style.borderColor='#E4E9F0';e.target.style.boxShadow='none'}}
              />
            </div>
          </PwdInput>
          <PrimaryBtn type="submit" disabled={loading}>
            {loading ? 'Signing in…' : <>Sign In <TbArrowRight size={16}/></>}
          </PrimaryBtn>
        </Stack>
      </form>
      <Text ta="center" mt="xl" style={{ fontFamily:"'DM Sans',sans-serif",fontSize:14,color:'#8A96A3' }}>
        Don't have an account?{' '}
        <Anchor component={Link} to="/register" style={{ fontFamily:"'DM Sans',sans-serif",fontWeight:700,color:'#012970' }}>Create one</Anchor>
      </Text>
    </>
  )

  return (
    <Page>
      <BrandPanel>
        <BrandOrb $size={400} $top="-120px" $left="-100px"/>
        <BrandOrb $size={280} $top="55%" $left="60%" $delay="2s"/>
        <Box style={{ display:'flex',alignItems:'center',gap:10,marginBottom:52 }}>
          <AppLogo size={36} variant="white"/>
          <Text style={{ fontFamily:"'DM Sans',sans-serif",fontWeight:800,fontSize:20,color:'#fff' }}>MedDeliverySOS</Text>
        </Box>
        <Text style={{ fontFamily:"'DM Sans',sans-serif",fontWeight:800,fontSize:32,color:'#fff',lineHeight:1.2,marginBottom:14 }}>Your pharmacy,<br/>at your doorstep.</Text>
        <Text style={{ fontFamily:"'DM Sans',sans-serif",fontSize:14,color:'rgba(255,255,255,0.65)',marginBottom:48,lineHeight:1.75 }}>Upload prescriptions, manage family profiles, and get medicines delivered — all in one place.</Text>
        {features.map(({Icon,title,desc})=>(
          <FeatureRow key={title}><FeatureIcon><Icon size={18} color="#fff"/></FeatureIcon><Box><Text style={{ fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:700,color:'#fff',marginBottom:2 }}>{title}</Text><Text style={{ fontFamily:"'DM Sans',sans-serif",fontSize:12,color:'rgba(255,255,255,0.6)' }}>{desc}</Text></Box></FeatureRow>
        ))}
        <Box style={{ height:1,background:'rgba(255,255,255,0.15)',margin:'28px 0 20px' }}/>
        <Text style={{ fontFamily:"'DM Sans',sans-serif",fontSize:11,color:'rgba(255,255,255,0.45)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10 }}>Other portals</Text>
        <Stack gap={8}>
          {[{to:'/pharmacy/login',label:'Pharmacy Staff'},{to:'/insurance/login',label:'Insurance Staff'},{to:'/delivery/login',label:'Delivery Team'}].map(({to,label})=>(
            <PortalLink key={to} to={to}><Text style={{ fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600,color:'#fff' }}>{label}</Text><TbArrowRight size={14} color="rgba(255,255,255,0.6)"/></PortalLink>
          ))}
        </Stack>
      </BrandPanel>
      <FormPanel>
        <MobileHero $lifted={lifted}>
          <MobileHeroOrb $size={300} $top="-80px" $left="-80px"/><MobileHeroOrb $size={200} $top="30%" $left="70%"/><MobileHeroOrb $size={150} $top="70%" $left="-20px"/>
          <PillIcon><AppLogo size={34} variant="white"/></PillIcon>
          <Text style={{ fontFamily:"'DM Sans',sans-serif",fontWeight:800,fontSize:26,color:'#fff',lineHeight:1.2,marginBottom:8 }}>MedDeliverySOS</Text>
          <Text style={{ fontFamily:"'DM Sans',sans-serif",fontSize:14,color:'rgba(255,255,255,0.7)' }}>Your pharmacy, at your doorstep</Text>
        </MobileHero>
        <Card $lifted={lifted} onFocus={handleFocusIn} onBlur={handleFocusOut}>{formContent}</Card>
      </FormPanel>
    </Page>
  )
}
