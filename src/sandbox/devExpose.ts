import { SandboxClient } from './SandboxClient';

export function exposeSandboxToWindow(): void {
  // Dev-only helper so you can test quickly from the browser console:
  //   await window.__whSandbox.run(`const r = await api.addUser({email:"a@b.com",name:"Ada"}); return r;`)
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const w = window as any;
  if (w.__whSandbox) return;
  w.__whSandbox = new SandboxClient();
  console.log(
    '[Sandbox] Dev helper ready: window.__whSandbox.run(code). Example:',
    'await window.__whSandbox.run(`const r = await api.addUser({ email: "a@b.com", name: "Ada" }); return r;`)'
  );
}

