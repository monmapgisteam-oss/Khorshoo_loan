/* ---------- ArcGIS Online нэвтрэлт (OAuth 2.0) ----------
   NEXT_PUBLIC_ARCGIS_CLIENT_ID тавигдсан үед л идэвхжинэ. Тавиагүй бол апп
   нэвтрэлтгүй, нээлттэй ажиллана (status: 'disabled').

   Урсгал: OAuthInfo бүртгэнэ -> checkSignInStatus (хуудас руу буцаж ирэхэд
   URL-ийн #access_token-ийг IdentityManager өөрөө уншина) -> нэвтрээгүй бол
   "Нэвтрэх" товч getCredential дуудаж ArcGIS-ийн нэвтрэх хуудас руу чиглүүлнэ.
   Нэвтэрсний дараа IdentityManager нь @arcgis/core-ийн бүх хүсэлтэд token
   нэмдэг; REST fetch-үүдэд (lib/data.ts) token-ийг бид өөрсдөө нэмнэ. */

import { createStore } from './store';

export const CLIENT_ID  = process.env.NEXT_PUBLIC_ARCGIS_CLIENT_ID || '';
export const PORTAL_URL = (process.env.NEXT_PUBLIC_ARCGIS_PORTAL_URL || 'https://www.arcgis.com').replace(/\/$/, '');
const SHARING_URL = PORTAL_URL + '/sharing';

export type AuthStatus = 'disabled' | 'loading' | 'signed-in' | 'signed-out' | 'error';

export interface AuthState {
  status: AuthStatus;
  user?: string;
  fullName?: string;
  token?: string;
  error?: string;
}

export const authStore = createStore<AuthState>({ status: CLIENT_ID ? 'loading' : 'disabled' });

let esriId: any = null;
let initPromise: Promise<void> | null = null;

async function loadIdentity(){
  if (esriId) return esriId;
  const [{ default: IdentityManager }, { default: OAuthInfo }] = await Promise.all([
    import('@arcgis/core/identity/IdentityManager'),
    import('@arcgis/core/identity/OAuthInfo')
  ]);
  const info = new OAuthInfo({
    appId: CLIENT_ID,
    portalUrl: PORTAL_URL,
    popup: false,          // хуудсаа бүхэлд нь ArcGIS-ийн нэвтрэх хуудас руу чиглүүлнэ
    flowType: 'auto'
  });
  IdentityManager.registerOAuthInfos([info]);
  esriId = IdentityManager;
  return esriId;
}

/** Нэвтэрсэн эсэхийг шалгана (нэг л удаа ажиллана) */
export function initAuth(): Promise<void> {
  if (!CLIENT_ID) return Promise.resolve();
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const id = await loadIdentity();
      const cred = await id.checkSignInStatus(SHARING_URL);
      await setSignedIn(cred);
    } catch (err: any) {
      // checkSignInStatus нь нэвтрээгүй үед reject хийдэг — энэ нь алдаа биш
      if (err && err.name === 'identity-manager:not-authenticated') authStore.set({ status: 'signed-out' });
      else if (err && err.name === 'identity-manager:user-aborted') authStore.set({ status: 'signed-out' });
      else {
        console.error('Нэвтрэлт шалгахад:', err);
        authStore.set({ status: 'error', error: err && err.message ? err.message : String(err) });
      }
    }
  })();
  return initPromise;
}

async function setSignedIn(cred: any){
  let fullName: string | undefined;
  try {
    const r = await fetch(`${SHARING_URL}/rest/community/self?f=json&token=${encodeURIComponent(cred.token)}`);
    const j = await r.json();
    fullName = j && j.fullName;
  } catch { /* нэр авч чадаагүй ч нэвтрэлт хүчинтэй */ }
  authStore.set({ status: 'signed-in', user: cred.userId, fullName, token: cred.token });
  // Token сунгагдах / солигдоход шинэчилнэ
  if (cred.on) cred.on('token-change', () => authStore.set(s => ({ ...s, token: cred.token })));
}

/** ArcGIS-ийн нэвтрэх хуудас руу чиглүүлнэ */
export async function signIn(){
  const id = await loadIdentity();
  authStore.set(s => ({ ...s, status: 'loading' }));
  try {
    const cred = await id.getCredential(SHARING_URL);
    await setSignedIn(cred);
  } catch (err: any) {
    authStore.set({ status: 'signed-out', error: err && err.name === 'identity-manager:user-aborted' ? undefined : (err && err.message) });
  }
}

/** Гарах: credential-уудыг устгаад хуудсыг дахин ачаална */
export async function signOut(){
  const id = await loadIdentity();
  id.destroyCredentials();
  window.location.reload();
}

/** REST fetch-д нэмэх token (нэвтрээгүй эсвэл идэвхгүй бол undefined) */
export function currentToken(): string | undefined {
  const s = authStore.get();
  return s.status === 'signed-in' ? s.token : undefined;
}
