const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/with-resolvers-BdQuHq6x.js","assets/rolldown-runtime-BWaJ3C7D.js","assets/src-MKeUudpy.js","assets/src-DsbpNrPb.js","assets/src-DmRoKWF9.js","assets/src-CWJhj7gz.js","assets/secp256k1-BhGEfYSD.js","assets/src-CfKQ3xzi.js","assets/src-T9Ec6Upa.js","assets/utils-DqTJipNR.js","assets/abstract-message-stream-BOSlQqEj.js","assets/src-BiZ72Vdr.js","assets/src-CSxrxj7d.js","assets/abstract-stream-CQDOE5Np.js","assets/repeating-task-BEqXNEuI.js","assets/src-B03dd6Rv.js","assets/debounce-Ce5Xs4fQ.js","assets/src-ChdVSMFa.js","assets/envelope-D3g8tDU6.js","assets/src-BBW655JB.js","assets/tracked-map-CHjVQWh-.js","assets/src-C705rW1x.js","assets/abstract-multiaddr-connection-BdPaILCj.js","assets/src-BS96Jf9M.js","assets/src-DdhcLCEI.js","assets/webrtc.browser-BEtgs6ZH.js","assets/p-timeout-KtNndngQ.js","assets/src-BHcVFdo-.js","assets/src-DZsg7xM1.js"])))=>i.map(i=>d[i]);
import{a as e,r as t}from"./rolldown-runtime-BWaJ3C7D.js";import{C as n,S as r,_ as i,a,b as o,c as s,d as c,f as l,g as u,h as d,i as ee,l as te,m as ne,o as re,p as f,r as ie,s as ae,u as p,v as oe,w as se,x as ce,y as m}from"./MintView-D25GAvyV.js";import{C as le,M as ue,c as de,l as h,o as g,s as fe,t as pe,u as _}from"./src-DmRoKWF9.js";import{a as v,d as me,i as he,l as ge,m as _e,o as y,r as ve,t as b}from"./src-CWJhj7gz.js";import{t as x}from"./index-BpoUBgEW.js";var ye=class{index=0;input=``;new(e){return this.index=0,this.input=e,this}readAtomically(e){let t=this.index,n=e();return n===void 0&&(this.index=t),n}parseWith(e){let t=e();if(this.index===this.input.length)return t}peekChar(){if(!(this.index>=this.input.length))return this.input[this.index]}readChar(){if(!(this.index>=this.input.length))return this.input[this.index++]}readGivenChar(e){return this.readAtomically(()=>{let t=this.readChar();if(t===e)return t})}readSeparator(e,t,n){return this.readAtomically(()=>{if(!(t>0&&this.readGivenChar(e)===void 0))return n()})}readNumber(e,t,n,r){return this.readAtomically(()=>{let i=0,a=0,o=this.peekChar();if(o===void 0)return;let s=o===`0`,c=2**(8*r)-1;for(;;){let n=this.readAtomically(()=>{let t=this.readChar();if(t===void 0)return;let n=Number.parseInt(t,e);if(!Number.isNaN(n))return n});if(n===void 0)break;if(i*=e,i+=n,i>c||(a+=1,t!==void 0&&a>t))return}if(a!==0&&!(!n&&s&&a>1))return i})}readIPv4Addr(){return this.readAtomically(()=>{let e=new Uint8Array(4);for(let t=0;t<e.length;t++){let n=this.readSeparator(`.`,t,()=>this.readNumber(10,3,!1,1));if(n===void 0)return;e[t]=n}return e})}readIPv6Addr(){let e=e=>{for(let t=0;t<e.length/2;t++){let n=t*2;if(t<e.length-3){let r=this.readSeparator(`:`,t,()=>this.readIPv4Addr());if(r!==void 0)return e[n]=r[0],e[n+1]=r[1],e[n+2]=r[2],e[n+3]=r[3],[n+4,!0]}let r=this.readSeparator(`:`,t,()=>this.readNumber(16,4,!0,2));if(r===void 0)return[n,!1];e[n]=r>>8,e[n+1]=r&255}return[e.length,!1]};return this.readAtomically(()=>{let t=new Uint8Array(16),[n,r]=e(t);if(n===16)return t;if(r||this.readGivenChar(`:`)===void 0||this.readGivenChar(`:`)===void 0)return;let i=new Uint8Array(14),a=16-(n+2),[o]=e(i.subarray(0,a));return t.set(i.subarray(0,o),16-o),t})}readIPAddr(){return this.readIPv4Addr()??this.readIPv6Addr()}},be=45,xe=15,S=new ye;function Se(e){if(!(e.length>xe))return S.new(e).parseWith(()=>S.readIPv4Addr())}function Ce(e){if(e.includes(`%`)&&(e=e.split(`%`)[0]),!(e.length>be))return S.new(e).parseWith(()=>S.readIPv6Addr())}function we(e,t=!1){if(e.includes(`%`)&&(e=e.split(`%`)[0]),e.length>be)return;let n=S.new(e).parseWith(()=>S.readIPAddr());if(n)return t&&n.length===4?Uint8Array.from([0,0,0,0,0,0,0,0,0,0,255,255,n[0],n[1],n[2],n[3]]):n}function C(e){return!!Se(e)}function Te(e){return!!Ce(e)}function Ee(e,t){if(e===t)return!0;if(e.byteLength!==t.byteLength)return!1;for(let n=0;n<e.byteLength;n++)if(e[n]!==t[n])return!1;return!0}function De(e){return e.buffer instanceof ArrayBuffer}function Oe(e){return De(e)?e:e.slice()}function ke(e=0){return new Uint8Array(e)}function Ae(e){return e?.buffer instanceof ArrayBuffer}function je(e){if(Ae(e))return e;let t=e.slice();return new Uint8Array(t.buffer,0,t.byteLength)}function w(e,t){t??=e.reduce((e,t)=>e+t.length,0);let n=ke(t),r=0;for(let t of e)n.set(t,r),r+=t.length;return je(n)}function Me(e,t,n,r){return{name:e,prefix:t,encoder:{name:e,prefix:t,encode:n},decoder:{decode:r}}}var Ne=Me(`utf8`,`u`,e=>`u`+new TextDecoder(`utf8`).decode(e),e=>new TextEncoder().encode(e.substring(1))),T=Me(`ascii`,`a`,e=>{let t=`a`;for(let n=0;n<e.length;n++)t+=String.fromCharCode(e[n]);return t},e=>{e=e.substring(1);let t=ke(e.length);for(let n=0;n<e.length;n++)t[n]=e.charCodeAt(n);return t}),Pe={utf8:Ne,"utf-8":Ne,hex:y.base16,latin1:T,ascii:T,binary:T,...y};function E(e,t=`utf8`){let n=Pe[t];if(n==null)throw Error(`Unsupported encoding "${t}"`);return n.decoder.decode(`${n.prefix}${e}`)}function D(e,t=`utf8`){let n=Pe[t];if(n==null)throw Error(`Unsupported encoding "${t}"`);return n.encoder.encode(e).substring(1)}var O=class extends Error{static name=`InvalidMultiaddrError`;name=`InvalidMultiaddrError`},k=class extends Error{static name=`ValidationError`;name=`ValidationError`},Fe=class extends Error{static name=`InvalidParametersError`;name=`InvalidParametersError`},Ie=class extends Error{static name=`UnknownProtocolError`;name=`UnknownProtocolError`};function Le(e){return t=>D(t,e)}function Re(e){return t=>E(t,e)}function A(e){return new DataView(e.buffer).getUint16(e.byteOffset).toString()}function j(e){let t=new ArrayBuffer(2);return new DataView(t).setUint16(0,typeof e==`string`?parseInt(e):e),new Uint8Array(t)}function ze(e){let t=e.split(`:`);if(t.length!==2)throw Error(`failed to parse onion addr: ["'${t.join(`", "`)}'"]' does not contain a port number`);if(t[0].length!==16)throw Error(`failed to parse onion addr: ${t[0]} not a Tor onion address.`);let n=E(t[0],`base32`),r=parseInt(t[1],10);if(r<1||r>65536)throw Error(`Port number is not in range(1, 65536)`);let i=j(r);return w([n,i],n.length+i.length)}function Be(e){let t=e.split(`:`);if(t.length!==2)throw Error(`failed to parse onion addr: ["'${t.join(`", "`)}'"]' does not contain a port number`);if(t[0].length!==56)throw Error(`failed to parse onion addr: ${t[0]} not a Tor onion3 address.`);let n=_e.decode(`b${t[0]}`),r=parseInt(t[1],10);if(r<1||r>65536)throw Error(`Port number is not in range(1, 65536)`);let i=j(r);return w([n,i],n.length+i.length)}function Ve(e){let t=e.subarray(0,e.length-2),n=e.subarray(e.length-2);return`${D(t,`base32`)}:${A(n)}`}var He=function(e){e=e.toString().trim();let t=new Uint8Array(4);return e.split(/\./g).forEach((e,n)=>{let r=parseInt(e,10);if(isNaN(r)||r<0||r>255)throw new O(`Invalid byte value in IP address`);t[n]=r}),t},Ue=function(e){let t=0;e=e.toString().trim();let n=e.split(`:`,8),r=0;for(;r<n.length;r++){let e=C(n[r]),t;e&&(t=He(n[r]),n[r]=D(t.subarray(0,2),`base16`)),t!=null&&++r<8&&n.splice(r,0,D(t.subarray(2,4),`base16`))}if(n[0]===``)for(;n.length<8;)n.unshift(`0`);else if(n[n.length-1]===``)for(;n.length<8;)n.push(`0`);else if(n.length<8){for(r=0;r<n.length&&n[r]!==``;r++);let e=[r,1];for(r=9-n.length;r>0;r--)e.push(`0`);n.splice.apply(n,e)}let i=new Uint8Array(t+16);for(r=0;r<n.length;r++){n[r]===``&&(n[r]=`0`);let e=parseInt(n[r],16);if(isNaN(e)||e<0||e>65535)throw new O(`Invalid byte value in IP address`);i[t++]=e>>8&255,i[t++]=e&255}return i},We=function(e){if(e.byteLength!==4)throw new O(`IPv4 address was incorrect length`);let t=[];for(let n=0;n<e.byteLength;n++)t.push(e[n]);return t.join(`.`)},Ge=function(e){if(e.byteLength!==16)throw new O(`IPv6 address was incorrect length`);let t=[];for(let n=0;n<e.byteLength;n+=2){let r=e[n],i=e[n+1],a=`${r.toString(16).padStart(2,`0`)}${i.toString(16).padStart(2,`0`)}`;t.push(a)}let n=t.join(`:`);try{let e=new URL(`http://[${n}]`);return e.hostname.substring(1,e.hostname.length-1)}catch{throw new O(`Invalid IPv6 address "${n}"`)}};function Ke(e){try{let t=new URL(`http://[${e}]`);return t.hostname.substring(1,t.hostname.length-1)}catch{throw new O(`Invalid IPv6 address "${e}"`)}}var M=Object.values(y).map(e=>e.decoder),qe=(function(){let e=M[0].or(M[1]);return M.slice(2).forEach(t=>e=e.or(t)),e})();function Je(e){return qe.decode(e)}function Ye(e){return t=>e.encoder.encode(t)}function Xe(e){if(parseInt(e).toString()!==e)throw new k(`Value must be an integer`)}function Ze(e){if(e<0)throw new k(`Value must be a positive integer, or zero`)}function Qe(e){return t=>{if(t>e)throw new k(`Value must be smaller than or equal to ${e}`)}}function $e(...e){return t=>{for(let n of e)n(t)}}var N=$e(Xe,Ze,Qe(65535)),P=new class{protocolsByCode=new Map;protocolsByName=new Map;getProtocol(e){let t;if(t=typeof e==`string`?this.protocolsByName.get(e):this.protocolsByCode.get(e),t==null)throw new Ie(`Protocol ${e} was unknown`);return t}addProtocol(e){this.protocolsByCode.set(e.code,e),this.protocolsByName.set(e.name,e),e.aliases?.forEach(t=>{this.protocolsByName.set(t,e)})}removeProtocol(e){let t=this.protocolsByCode.get(e);t!=null&&(this.protocolsByCode.delete(t.code),this.protocolsByName.delete(t.name),t.aliases?.forEach(e=>{this.protocolsByName.delete(e)}))}};[{code:4,name:`ip4`,size:32,valueToBytes:He,bytesToValue:We,validate:e=>{if(!C(e))throw new k(`Invalid IPv4 address "${e}"`)}},{code:6,name:`tcp`,size:16,valueToBytes:j,bytesToValue:A,validate:N},{code:273,name:`udp`,size:16,valueToBytes:j,bytesToValue:A,validate:N},{code:33,name:`dccp`,size:16,valueToBytes:j,bytesToValue:A,validate:N},{code:41,name:`ip6`,size:128,valueToBytes:Ue,bytesToValue:Ge,stringToValue:Ke,validate:e=>{if(!Te(e))throw new k(`Invalid IPv6 address "${e}"`)}},{code:42,name:`ip6zone`,size:-1},{code:43,name:`ipcidr`,size:8,bytesToValue:Le(`base10`),valueToBytes:Re(`base10`)},{code:53,name:`dns`,size:-1},{code:54,name:`dns4`,size:-1},{code:55,name:`dns6`,size:-1},{code:56,name:`dnsaddr`,size:-1},{code:132,name:`sctp`,size:16,valueToBytes:j,bytesToValue:A,validate:N},{code:301,name:`udt`},{code:302,name:`utp`},{code:400,name:`unix`,size:-1,stringToValue:e=>decodeURIComponent(e),valueToString:e=>encodeURIComponent(e)},{code:421,name:`p2p`,aliases:[`ipfs`],size:-1,bytesToValue:Le(`base58btc`),valueToBytes:e=>e.startsWith(`Q`)||e.startsWith(`1`)?Re(`base58btc`)(e):me.parse(e).multihash.bytes},{code:444,name:`onion`,size:96,bytesToValue:Ve,valueToBytes:ze},{code:445,name:`onion3`,size:296,bytesToValue:Ve,valueToBytes:Be},{code:446,name:`garlic64`,size:-1},{code:447,name:`garlic32`,size:-1},{code:448,name:`tls`},{code:449,name:`sni`,size:-1},{code:454,name:`noise`},{code:460,name:`quic`},{code:461,name:`quic-v1`},{code:465,name:`webtransport`},{code:466,name:`certhash`,size:-1,bytesToValue:Ye(ge),valueToBytes:Je},{code:480,name:`http`},{code:481,name:`http-path`,size:-1,stringToValue:e=>`/${decodeURIComponent(e)}`,valueToString:e=>encodeURIComponent(e.substring(1))},{code:443,name:`https`},{code:477,name:`ws`},{code:478,name:`wss`},{code:479,name:`p2p-websocket-star`},{code:277,name:`p2p-stardust`},{code:275,name:`p2p-webrtc-star`},{code:276,name:`p2p-webrtc-direct`},{code:280,name:`webrtc-direct`},{code:281,name:`webrtc`},{code:290,name:`p2p-circuit`},{code:777,name:`memory`,size:-1}].forEach(e=>{P.addProtocol(e)});function et(e){let t=[],n=0;for(;n<e.length;){let r=b(e,n),i=P.getProtocol(r),a=v(r),o=it(i,e,n+a),s=0;o>0&&i.size===-1&&(s=v(o));let c=a+s+o,l={code:r,name:i.name,bytes:Oe(e.subarray(n,n+c))};if(o>0){let t=n+a+s,r=e.subarray(t,t+o);l.value=i.bytesToValue?.(r)??D(r)}t.push(l),n+=c}return t}function tt(e){let t=0,n=[];for(let r of e){if(r.bytes==null){let e=P.getProtocol(r.code),t=v(r.code),n,i=0,a=0;r.value!=null&&(n=e.valueToBytes?.(r.value)??E(r.value),i=n.byteLength,e.size===-1&&(a=v(i)));let o=new Uint8Array(t+a+i),s=0;he(r.code,o,s),s+=t,n!=null&&(e.size===-1&&(he(i,o,s),s+=a),o.set(n,s)),r.bytes=o}n.push(r.bytes),t+=r.bytes.byteLength}return w(n,t)}function nt(e){if(e.charAt(0)!==`/`)throw new O(`String multiaddr must start with "/"`);let t=[],n=`protocol`,r=``,i=``;for(let a=1;a<e.length;a++){let o=e.charAt(a);o!==`/`&&(n===`protocol`?i+=e.charAt(a):r+=e.charAt(a));let s=a===e.length-1;if(o===`/`||s){let e=P.getProtocol(i);if(n===`protocol`){if(e.size==null||e.size===0){t.push({code:e.code,name:e.name}),r=``,i=``,n=`protocol`;continue}if(s)throw new O(`Component ${i} was missing value`);n=`value`}else if(n===`value`){let a={code:e.code,name:e.name};if(e.size!=null&&e.size!==0){if(r===``)throw new O(`Component ${i} was missing value`);a.value=e.stringToValue?.(r)??r}t.push(a),r=``,i=``,n=`protocol`}}}if(i!==``&&r!==``)throw new O(`Incomplete multiaddr`);return t}function rt(e){return`/${e.flatMap(e=>{if(e.value==null)return e.name;let t=P.getProtocol(e.code);if(t==null)throw new O(`Unknown protocol code ${e.code}`);return[e.name,t.valueToString?.(e.value)??e.value]}).join(`/`)}`}function it(e,t,n){return e.size==null||e.size===0?0:e.size>0?e.size/8:b(t,n)}var at=Symbol.for(`nodejs.util.inspect.custom`),ot=Symbol.for(`@multiformats/multiaddr`);function st(e){if(e??=`/`,ut(e))return e.getComponents();if(e instanceof Uint8Array)return et(e);if(typeof e==`string`)return e=e.replace(/\/(\/)+/,`/`).replace(/(\/)+$/,``),e===``&&(e=`/`),nt(e);if(Array.isArray(e))return e;throw new O(`Must be a string, Uint8Array, Component[], or another Multiaddr`)}var ct=class e{[ot]=!0;#e;#t;#n;constructor(e=`/`,t={}){this.#e=st(e),t.validate!==!1&&lt(this)}get bytes(){return this.#n??=tt(this.#e),this.#n}toString(){return this.#t??=rt(this.#e),this.#t}toJSON(){return this.toString()}getComponents(){return[...this.#e.map(e=>({...e}))]}encapsulate(t){let n=new e(t);return new e([...this.#e,...n.getComponents()],{validate:!1})}decapsulate(t){let n=t.toString(),r=this.toString(),i=r.lastIndexOf(n);if(i<0)throw new Fe(`Address ${this.toString()} does not contain subaddress: ${n}`);return new e(r.slice(0,i),{validate:!1})}decapsulateCode(t){let n;for(let e=this.#e.length-1;e>-1;e--)if(this.#e[e].code===t){n=e;break}return new e(this.#e.slice(0,n),{validate:!1})}equals(e){return Ee(this.bytes,e.bytes)}[at](){return`Multiaddr(${this.toString()})`}};function lt(e){e.getComponents().forEach(e=>{let t=P.getProtocol(e.code);e.value!=null&&t.validate?.(e.value)})}function ut(e){return!!e?.[ot]}function F(e){return new ct(e)}var dt=class{readNext;haveNext;ended;nextResult;error;constructor(){this.ended=!1,this.readNext=h(),this.haveNext=h()}[Symbol.asyncIterator](){return this}async next(){if(this.nextResult??await this.haveNext.promise,this.nextResult==null)throw Error(`HaveNext promise resolved but nextResult was undefined`);let e=this.nextResult;return this.nextResult=void 0,this.readNext.resolve(),this.readNext=h(),e}async throw(e){return this.ended=!0,this.error=e,e!=null&&(this.haveNext.promise.catch(()=>{}),this.haveNext.reject(e)),{done:!0,value:void 0}}async return(){let e={done:!0,value:void 0};return this.ended=!0,this.nextResult=e,this.haveNext.resolve(),e}async push(e,t){await this._push(e,t)}async end(e,t){e==null?await this._push(void 0,t):await this.throw(e)}async _push(e,t){if(e!=null&&this.ended)throw this.error??Error(`Cannot push value onto an ended pushable`);for(;this.nextResult!=null;)await this.readNext.promise;e==null?(this.ended=!0,this.nextResult={done:!0,value:void 0}):this.nextResult={done:!1,value:e},this.haveNext.resolve(),this.haveNext=h(),await pe(this.readNext.promise,t?.signal,t)}};function ft(){return new dt}function pt(e){return e[Symbol.asyncIterator]!=null}async function mt(e,t,n){try{await Promise.all(e.map(async e=>{for(;;){let{value:r,done:i}=await e.next();if(i===!0)break;await t.push(r,{signal:n}),n.throwIfAborted()}})),await t.end(void 0,{signal:n})}catch(e){await t.end(e,{signal:n}).catch(()=>{})}}async function*ht(e){let t=new AbortController,n=ft(),r=e.map(e=>pt(e)?e[Symbol.asyncIterator]():e[Symbol.iterator]());mt(r,n,t.signal).catch(()=>{});try{yield*n}finally{t.abort();for(let e of r)try{Promise.resolve(e.return?.()).catch(()=>{})}catch{}}}function*gt(e){for(let t of e)yield*t}function _t(...e){let t=[];for(let n of e)pt(n)||t.push(n);return t.length===e.length?gt(t):ht(e)}function vt(e,...t){if(e==null)throw Error(`Empty pipeline`);if(I(e)){let t=e;e=()=>t.source}else if(xt(e)||bt(e)){let t=e;e=()=>t}let n=[e,...t];if(n.length>1&&I(n[n.length-1])&&(n[n.length-1]=n[n.length-1].sink),n.length>2)for(let e=1;e<n.length-1;e++)I(n[e])&&(n[e]=St(n[e]));return yt(...n)}var yt=(...e)=>{let t;for(;e.length>0;)t=e.shift()(t);return t},bt=e=>e?.[Symbol.asyncIterator]!=null,xt=e=>e?.[Symbol.iterator]!=null,I=e=>e!=null&&e.sink!=null&&e.source!=null,St=e=>t=>{let n=e.sink(t);if(n?.then!=null){let t=de({objectMode:!0});n.then(()=>{t.end()},e=>{t.end(e)});let r,i=e.source;if(bt(i))r=async function*(){yield*i,t.end()};else if(xt(i))r=function*(){yield*i,t.end()};else throw Error(`Unknown duplex source type - must be Iterable or AsyncIterable`);return _t(t,r())}return e.source},Ct=4194304,wt=class extends Error{static name=`UnwrappedError`;name=`UnwrappedError`},Tt=class extends Error{name=`InvalidMessageLengthError`;code=`ERR_INVALID_MSG_LENGTH`},Et=class extends Error{name=`InvalidDataLengthError`;code=`ERR_MSG_DATA_TOO_LONG`},Dt=class extends Error{name=`InvalidDataLengthLengthError`;code=`ERR_MSG_LENGTH_TOO_LONG`};function Ot(e){return typeof e?.closeRead==`function`}function kt(e){return typeof e?.close==`function`}function L(e){return Ot(e)?e.remoteWriteStatus!==`writable`&&e.readBufferLength===0:kt(e)?e.status!==`open`:!1}function At(e){return e?.addEventListener!=null&&e?.removeEventListener!=null&&e?.send!=null&&e?.push!=null&&e?.log!=null}function jt(e,t){let n=t?.maxBufferSize??Ct,r=new _,i,a=!1,o;if(!At(e))throw new le(`Argument should be a Stream or a Multiaddr`);let s=t=>{if(!a&&o==null){if(r.append(t.data),r.byteLength>n){let t=r.byteLength;r.consume(t);let a=new ue(`Read buffer overflow - ${t} > ${n}`);o=a,i?.reject(a),queueMicrotask(()=>{e.abort(a)})}else i?.resolve()}};e.addEventListener(`message`,s);let c=e=>{e.error==null?i?.resolve():i?.reject(e.error)};e.addEventListener(`close`,c);let l=()=>{i?.resolve()};e.addEventListener(`remoteCloseWrite`,l);let u={readBuffer:r,async read(t){if(a===!0)throw new wt(`Stream was unwrapped`);if(o!=null)throw o;if(L(e)){if(r.byteLength===0&&t?.bytes==null)return null;if(t?.bytes!=null&&r.byteLength<t.bytes)throw e.log.error(`closed after reading %d/%d bytes`,r.byteLength,t.bytes),new g(`Unexpected EOF - stream closed after reading ${r.byteLength}/${t.bytes} bytes`)}let n=t?.bytes??1;for(i=Promise.withResolvers();;){if(r.byteLength>=n){i.resolve();break}if(await pe(i.promise,t?.signal),L(e)){if(r.byteLength===0&&t?.bytes==null)return null;break}i=Promise.withResolvers()}let s=t?.bytes??r.byteLength;if(r.byteLength<s){if(L(e))throw e.log.error(`closed while reading %d/%d bytes`,r.byteLength,s),new g(`Unexpected EOF - stream closed while reading ${r.byteLength}/${s} bytes`);return u.read(t)}let c=r.sublist(0,s);return r.consume(s),c},async write(t,n){if(a===!0)throw new wt(`Stream was unwrapped`);e.send(t)||await fe(e,`drain`,{signal:n?.signal,rejectionEvents:[`close`]})},unwrap(){return a||(a=!0,e.removeEventListener(`message`,s),e.removeEventListener(`close`,c),e.removeEventListener(`remoteCloseWrite`,l),r.byteLength>0&&(e.log(`stream unwrapped with %d unread bytes`,r.byteLength),e.unshift(r),r.consume(r.byteLength))),e}};return u}function R(e,t={}){let n=jt(e,t);t.maxDataLength!=null&&t.maxLengthLength==null&&(t.maxLengthLength=v(t.maxDataLength));let r=t?.lengthDecoder??b,i=t?.lengthEncoder??ve;return{async read(i){let a=-1,o=new _;for(;;){let e=await n.read({...i,bytes:1});if(e==null)break;o.append(e);try{a=r(o)}catch(e){if(e instanceof RangeError)continue;throw e}if(a<0)throw new Tt(`Invalid message length`);if(t?.maxLengthLength!=null&&o.byteLength>t.maxLengthLength)throw new Dt(`Message length length too long - ${o.byteLength} > ${t.maxLengthLength}`);if(a>-1)break}if(t?.maxDataLength!=null&&a>t.maxDataLength)throw new Et(`Message length too long - ${a} > ${t.maxDataLength}`);let s=await n.read({...i,bytes:a});if(s==null)throw e.log.error(`tried to read %d bytes but the stream closed`,a),new g(`Unexpected EOF - tried to read ${a} bytes but the stream closed`);if(s.byteLength!==a)throw e.log.error(`read %d/%d bytes before the stream closed`,s.byteLength,a),new g(`Unexpected EOF - read ${s.byteLength}/${a} bytes before the stream closed`);return s},async write(e,t){await n.write(new _(i(e.byteLength),e),t)},async writeV(e,t){let r=new _(...e.flatMap(e=>[i(e.byteLength),e]));await n.write(r,t)},unwrap(){return n.unwrap()}}}function Mt(e,t){let n=R(e,t),r={read:async(e,t)=>{let r=await n.read(t);return e.decode(r,t)},write:async(e,t,r)=>{await n.write(t.encode(e),r)},writeV:async(e,t,r)=>{await n.writeV(e.map(e=>t.encode(e)),r)},pb:e=>({read:async t=>r.read(e,t),write:async(t,n)=>r.write(t,e,n),writeV:async(t,n)=>r.writeV(t,e,n),unwrap:()=>r}),unwrap:()=>n.unwrap()};return r}function Nt(e){return e?.addEventListener!=null}function Pt(e){let t=de(),n,r=e=>{t.push(e.data)},i=()=>{t.end(),e.removeEventListener(`message`,r),e.removeEventListener(`close`,a),e.removeEventListener(`remoteCloseWrite`,i)},a=o=>{t.end(o.error),o.error!=null&&n?.reject(o.error),e.removeEventListener(`message`,r),e.removeEventListener(`close`,a),e.removeEventListener(`remoteCloseWrite`,i)};return e.addEventListener(`message`,r),e.addEventListener(`close`,a,{once:!0}),e.addEventListener(`remoteCloseWrite`,i,{once:!0}),{source:t,async sink(t){async function*r(){yield*t}let i=r();for(;;){n=Promise.withResolvers();let{done:t,value:r}=await Promise.race([i.next(),n.promise]);if(e.writeStatus===`closing`||e.writeStatus===`closed`||(r!=null&&(e.send(r)||await Promise.race([fe(e,`drain`,{rejectionEvents:[`close`]})])),t===!0))break}await e.close()}}}function Ft(...e){return vt(...e.map(e=>Nt(e)?Pt(e):e))}function z(e=0){return new Uint8Array(e)}function B(e=0){return new Uint8Array(e)}function It(e){return e?.buffer instanceof ArrayBuffer}function Lt(e){if(It(e))return e;let t=e.slice();return new Uint8Array(t.buffer,0,t.byteLength)}function Rt(e,t){t??=e.reduce((e,t)=>e+t.length,0);let n=B(t),r=0;for(let t of e)n.set(t,r),r+=t.length;return Lt(n)}function zt(e,t){if(e===t)return!0;if(e.byteLength!==t.byteLength)return!1;for(let n=0;n<e.byteLength;n++)if(e[n]!==t[n])return!1;return!0}var Bt=Symbol.for(`@achingbrain/uint8arraylist`);function Vt(e,t){if(t==null||t<0)throw RangeError(`index is out of bounds`);let n=0;for(let r of e){let e=n+r.byteLength;if(t<e)return{buf:r,index:t-n};n=e}throw RangeError(`index is out of bounds`)}function V(e){return!!e?.[Bt]}var Ht=class e{bufs;length;[Bt]=!0;constructor(...e){this.bufs=[],this.length=0,e.length>0&&this.appendAll(e)}*[Symbol.iterator](){yield*this.bufs}get byteLength(){return this.length}append(...e){this.appendAll(e)}appendAll(e){let t=0;for(let n of e)if(n instanceof Uint8Array)t+=n.byteLength,this.bufs.push(n);else if(V(n)){t+=n.byteLength;for(let e of n.bufs)this.bufs.push(e)}else throw Error(`Could not append value, must be an Uint8Array or a Uint8ArrayList`);this.length+=t}prepend(...e){this.prependAll(e)}prependAll(e){let t=0;for(let n of e.reverse())if(n instanceof Uint8Array)t+=n.byteLength,this.bufs.unshift(n);else if(V(n))t+=n.byteLength,this.bufs.unshift(...n.bufs);else throw Error(`Could not prepend value, must be an Uint8Array or a Uint8ArrayList`);this.length+=t}get(e){let t=Vt(this.bufs,e);return t.buf[t.index]}set(e,t){let n=Vt(this.bufs,e);n.buf[n.index]=t}write(e,t=0){if(e instanceof Uint8Array)for(let n=0;n<e.length;n++)this.set(t+n,e[n]);else if(V(e))for(let n=0;n<e.length;n++)this.set(t+n,e.get(n));else throw Error(`Could not write value, must be an Uint8Array or a Uint8ArrayList`)}consume(e){if(e=Math.trunc(e),!(Number.isNaN(e)||e<=0)){if(e===this.byteLength)this.bufs=[],this.length=0;else for(;this.bufs.length>0;)if(e>=this.bufs[0].byteLength)e-=this.bufs[0].byteLength,this.length-=this.bufs[0].byteLength,this.bufs.shift();else{this.bufs[0]=this.bufs[0].subarray(e),this.length-=e;break}}}slice(e,t){let{bufs:n,length:r}=this._subList(e,t);return Rt(n,r)}subarray(e,t){let{bufs:n,length:r}=this._subList(e,t);return n.length===1?n[0]:Rt(n,r)}sublist(t,n){let{bufs:r,length:i}=this._subList(t,n),a=new e;return a.length=i,a.bufs=r,a}_subList(e,t){if(e??=0,t??=this.length,e<0&&(e=this.length+e),t<0&&(t=this.length+t),e<0||t>this.length)throw RangeError(`index is out of bounds`);if(e===t)return{bufs:[],length:0};if(e===0&&t===this.length)return{bufs:[...this.bufs],length:this.length};let n=[],r=0;for(let i=0;i<this.bufs.length;i++){let a=this.bufs[i],o=r,s=o+a.byteLength;if(r=s,e>=s)continue;let c=e>=o&&e<s,l=t>o&&t<=s;if(c&&l){if(e===o&&t===s){n.push(a);break}let r=e-o;n.push(a.subarray(r,r+(t-e)));break}if(c){if(e===0){n.push(a);continue}n.push(a.subarray(e-o))}else{if(l){if(t===s){n.push(a);break}n.push(a.subarray(0,t-o));break}n.push(a)}}return{bufs:n,length:t-e}}indexOf(e,t=0){if(!V(e)&&!(e instanceof Uint8Array))throw TypeError(`The "value" argument must be a Uint8ArrayList or Uint8Array`);let n=e instanceof Uint8Array?e:e.subarray();if(t=Number(t??0),isNaN(t)&&(t=0),t<0&&(t=this.length+t),t<0&&(t=0),e.length===0)return t>this.length?this.length:t;let r=n.byteLength;if(r===0)throw TypeError(`search must be at least 1 byte long`);let i=new Int32Array(256);for(let e=0;e<256;e++)i[e]=-1;for(let e=0;e<r;e++)i[n[e]]=e;let a=i,o=this.byteLength-n.byteLength,s=n.byteLength-1,c;for(let e=t;e<=o;e+=c){c=0;for(let t=s;t>=0;t--){let r=this.get(e+t);if(n[t]!==r){c=Math.max(1,t-a[r]);break}}if(c===0)return e}return-1}getInt8(e){let t=this.subarray(e,e+1);return new DataView(t.buffer,t.byteOffset,t.byteLength).getInt8(0)}setInt8(e,t){let n=B(1);new DataView(n.buffer,n.byteOffset,n.byteLength).setInt8(0,t),this.write(n,e)}getInt16(e,t){let n=this.subarray(e,e+2);return new DataView(n.buffer,n.byteOffset,n.byteLength).getInt16(0,t)}setInt16(e,t,n){let r=z(2);new DataView(r.buffer,r.byteOffset,r.byteLength).setInt16(0,t,n),this.write(r,e)}getInt32(e,t){let n=this.subarray(e,e+4);return new DataView(n.buffer,n.byteOffset,n.byteLength).getInt32(0,t)}setInt32(e,t,n){let r=z(4);new DataView(r.buffer,r.byteOffset,r.byteLength).setInt32(0,t,n),this.write(r,e)}getBigInt64(e,t){let n=this.subarray(e,e+8);return new DataView(n.buffer,n.byteOffset,n.byteLength).getBigInt64(0,t)}setBigInt64(e,t,n){let r=z(8);new DataView(r.buffer,r.byteOffset,r.byteLength).setBigInt64(0,t,n),this.write(r,e)}getUint8(e){let t=this.subarray(e,e+1);return new DataView(t.buffer,t.byteOffset,t.byteLength).getUint8(0)}setUint8(e,t){let n=B(1);new DataView(n.buffer,n.byteOffset,n.byteLength).setUint8(0,t),this.write(n,e)}getUint16(e,t){let n=this.subarray(e,e+2);return new DataView(n.buffer,n.byteOffset,n.byteLength).getUint16(0,t)}setUint16(e,t,n){let r=z(2);new DataView(r.buffer,r.byteOffset,r.byteLength).setUint16(0,t,n),this.write(r,e)}getUint32(e,t){let n=this.subarray(e,e+4);return new DataView(n.buffer,n.byteOffset,n.byteLength).getUint32(0,t)}setUint32(e,t,n){let r=z(4);new DataView(r.buffer,r.byteOffset,r.byteLength).setUint32(0,t,n),this.write(r,e)}getBigUint64(e,t){let n=this.subarray(e,e+8);return new DataView(n.buffer,n.byteOffset,n.byteLength).getBigUint64(0,t)}setBigUint64(e,t,n){let r=z(8);new DataView(r.buffer,r.byteOffset,r.byteLength).setBigUint64(0,t,n),this.write(r,e)}getFloat32(e,t){let n=this.subarray(e,e+4);return new DataView(n.buffer,n.byteOffset,n.byteLength).getFloat32(0,t)}setFloat32(e,t,n){let r=z(4);new DataView(r.buffer,r.byteOffset,r.byteLength).setFloat32(0,t,n),this.write(r,e)}getFloat64(e,t){let n=this.subarray(e,e+8);return new DataView(n.buffer,n.byteOffset,n.byteLength).getFloat64(0,t)}setFloat64(e,t,n){let r=z(8);new DataView(r.buffer,r.byteOffset,r.byteLength).setFloat64(0,t,n),this.write(r,e)}equals(t){if(t==null||!(t instanceof e)||t.bufs.length!==this.bufs.length)return!1;for(let e=0;e<this.bufs.length;e++)if(!zt(this.bufs[e],t.bufs[e]))return!1;return!0}static fromUint8Arrays(t,n){let r=new e;return r.bufs=t,n??=t.reduce((e,t)=>e+t.byteLength,0),r.length=n,r}},Ut=class extends Error{name=`InvalidMessageLengthError`;code=`ERR_INVALID_MSG_LENGTH`},Wt=class extends Error{name=`InvalidDataLengthError`;code=`ERR_MSG_DATA_TOO_LONG`},Gt=class extends Error{name=`InvalidDataLengthLengthError`;code=`ERR_MSG_LENGTH_TOO_LONG`},Kt=class extends Error{name=`UnexpectedEOFError`;code=`ERR_UNEXPECTED_EOF`};function qt(e){return e[Symbol.asyncIterator]!=null}function Jt(e,t){if(e.byteLength>t)throw new Wt(`Message length too long`)}var H=e=>{let t=v(e),n=B(t);return ve(e,n),H.bytes=t,n};H.bytes=0;function U(e,t){t??={};let n=t.lengthEncoder??H,r=t?.maxDataLength??4194304;function*i(e){Jt(e,r);let t=n(e.byteLength);t instanceof Uint8Array?yield t:yield*t,e instanceof Uint8Array?yield e:yield*e}return qt(e)?(async function*(){for await(let t of e)yield*i(t)})():(function*(){for(let t of e)yield*i(t)})()}U.single=(e,t)=>{t??={};let n=t.lengthEncoder??H;return Jt(e,t?.maxDataLength??4194304),new Ht(n(e.byteLength),e)};var W;(function(e){e[e.LENGTH=0]=`LENGTH`,e[e.DATA=1]=`DATA`})(W||={});var G=e=>{let t=b(e);return G.bytes=v(t),t};G.bytes=0;function K(e,t){let n=new Ht,r=W.LENGTH,i=-1,a=t?.lengthDecoder??G,o=t?.maxLengthLength??8,s=t?.maxDataLength??4194304;function*c(){for(;n.byteLength>0;){if(r===W.LENGTH)try{if(i=a(n),i<0)throw new Ut(`Invalid message length`);if(i>s)throw new Wt(`Message length too long`);let e=a.bytes;n.consume(e),t?.onLength!=null&&t.onLength(i),r=W.DATA}catch(e){if(e instanceof RangeError){if(n.byteLength>o)throw new Gt(`Message length length too long`);break}throw e}if(r===W.DATA){if(n.byteLength<i)break;let e=n.sublist(0,i);n.consume(i),t?.onData!=null&&t.onData(e),yield e,r=W.LENGTH}}}return qt(e)?(async function*(){for await(let t of e)n.append(t),yield*c();if(n.byteLength>0)throw new Kt(`Unexpected end of input`)})():(function*(){for(let t of e)n.append(t),yield*c();if(n.byteLength>0)throw new Kt(`Unexpected end of input`)})()}K.fromReader=(e,t)=>{let n=1,r=async function*(){for(;;)try{let{done:t,value:r}=await e.next(n);if(t===!0)return;r!=null&&(yield r)}catch(e){if(e.code===`ERR_UNDER_READ`)return{done:!0,value:null};throw e}finally{n=1}}(),i=e=>{n=e};return K(r,{...t??{},onLength:i})};var Yt=n`<svg
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
  <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
  <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
  <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
  <path d="M7 12h10"></path>
</svg>`,Xt=Object.defineProperty,Zt=(e,t)=>{let n={};for(var r in e)Xt(n,r,{get:e[r],enumerable:!0});return t||Xt(n,Symbol.toStringTag,{value:`Module`}),n};async function Qt(e,t,n){let r=(await e.peerStore.get(t)).addresses.flatMap(({multiaddr:e})=>{let n=$t(e,t);return n?[n]:[]});if(r.length!==0)return n?e.dial(r,{signal:n}):e.dial(r)}function $t(e,t){let n=e.getComponents().at(-1);return n?.name===`p2p`?n.value===t.toString()?e:void 0:e.encapsulate(`/p2p/${t.toString()}`)}var en=class{constructor(e,t){this.components=e,this.config=t,this.errorListeners=new Set;let n=t.maxMessageLength??1048576;if(!Number.isSafeInteger(n)||n<=0)throw Error(`Maximum JSON-RPC message length must be a positive integer`);this.maxMessageLength=n;let r=t.timeout??3e4;if(!Number.isSafeInteger(r)||r<=0)throw Error(`JSON-RPC request timeout must be a positive integer`);this.timeout=r}onError(e){return this.errorListeners.add(e),()=>this.errorListeners.delete(e)}async start(){await this.components.registrar.handle(this.config.protocol,this.handleProtocol.bind(this),{runOnLimitedConnection:!0})}async stop(){await this.components.registrar.unhandle(this.config.protocol)}async handleProtocol(e,t){let n=!1,r=new AbortController,i=AbortSignal.timeout(this.timeout),a=e=>{n=!0;let t=Error(e.error?.message??`JSON-RPC stream closed`);t.name=`AbortError`,r.abort(t)},o=()=>{n=!0;let t=an(i,`JSON-RPC request timed out`);r.abort(t),e.abort(t)};e.addEventListener(`close`,a,{once:!0}),i.addEventListener(`abort`,o,{once:!0}),e.status!==`open`&&a({});try{let i=R(e,{maxDataLength:this.maxMessageLength}),o=nn(s.bytesTo((await i.read({signal:r.signal})).subarray(),`utf8`)),c;try{r.signal.throwIfAborted(),c={jsonrpc:`2.0`,id:o.id,result:await Promise.race([Promise.resolve(this.handleRequest({connection:t,peerId:t.remotePeer,payload:o,signal:r.signal})),s.abortSignalToPromise(r.signal)])}}catch(e){n||=on(e);let t=tn(e);c={jsonrpc:`2.0`,id:o.id,error:{code:t.code,message:t.message,data:t.data}}}await i.write(s.bytesFrom(JSON.stringify(c),`utf8`),{signal:r.signal}),e.removeEventListener(`close`,a),await e.close({signal:r.signal})}catch(t){if(n)return;this.handleError(t,e)}finally{e.removeEventListener(`close`,a),i.removeEventListener(`abort`,o)}}handleError(e,t){let n=rn(e);return t?.abort(n),this.errorListeners.forEach(e=>e(n)),n}};function tn(e){return e instanceof a?e:new a({code:-32603,message:rn(e).message})}function nn(e){let t=JSON.parse(e);if(t?.jsonrpc!==`2.0`||typeof t.id!=`number`&&typeof t.id!=`string`||typeof t.method!=`string`)throw Error(`Invalid JSON-RPC request`);return t}function rn(e){return e instanceof Error?e:Error(`JSON-RPC request failed`)}function an(e,t){return e.reason instanceof Error?e.reason:Error(t)}function on(e){return e instanceof Error&&(e.name===`AbortError`||e.name===`TimeoutError`)}function sn(e,t){return n=>new class extends en{handleRequest(e){return t.call(this,e)}}(n,e)}var cn=class{constructor(e,t,n){this.node=e,this.peerId=t,this.config=n;let r=n.maxMessageLength??1048576;if(!Number.isSafeInteger(r)||r<=0)throw Error(`Maximum JSON-RPC message length must be a positive integer`);this.maxMessageLength=r;let i=n.timeout??3e4;if(!Number.isSafeInteger(i)||i<=0)throw Error(`JSON-RPC request timeout must be a positive integer`);this.timeout=i}async request(e,t){let n=AbortSignal.timeout(t?.timeout??this.timeout),r=[this.config.signal,t?.signal,n].filter(e=>e!==void 0),i=s.abortSignalAny(r),a,o;try{a=await this.openStream(i);let t=R(a,{maxDataLength:this.maxMessageLength});await t.write(s.bytesFrom(JSON.stringify(e),`utf8`),{signal:i}),await a.close({signal:i}),o=JSON.parse(s.bytesTo((await t.read({signal:i})).subarray(),`utf8`)),await a.closeRead({signal:i}),i.throwIfAborted()}catch(e){let t=un(e);throw a?.abort(t),t}return this.config.onResponse?.(o),o}async openStream(e){Qt(this.node,this.peerId).catch(()=>{});for(let t of this.connections())try{return await t.newStream(this.config.protocol,{runOnLimitedConnection:!0,signal:e})}catch{e.throwIfAborted()}return this.node.dialProtocol(this.peerId,this.config.protocol,{runOnLimitedConnection:!0,signal:e})}connections(){return this.node.getConnections(this.peerId).filter(({status:e})=>e===`open`).sort(ln)}};function ln(e,t){return e.direct===t.direct?e.rtt===void 0?t.rtt===void 0?0:1:t.rtt===void 0?-1:e.rtt-t.rtt:e.direct?-1:1}function un(e){return e instanceof Error?e:Error(`JSON-RPC request failed`)}var q=16384,dn=[`addresses`,`role`,`secret`],J=class extends Error{constructor(e,t){super(e,t),this.name=`PairingEndpointError`}},fn=class extends J{constructor(e,t){super(`Expected a ${e} pairing endpoint, received ${t?`role "${t}"`:`an endpoint without a role`}`),this.expectedRole=e,this.actualRole=t,this.name=`PairingEndpointRoleError`}};async function pn(e,t,n,r){if(t.length===0)throw Error(`Pairing endpoint requires at least one address`);if(t.length>16)throw Error(`Pairing endpoint supports at most 16 addresses`);let i=gn(t);if(i.byteLength>q)throw Error(`Pairing endpoint address data is too large`);let a=await vn(i,new CompressionStream(`deflate`)),o=s.bytesTo(a,`base64url`),c=new URL(e),{params:l,route:u}=hn(c);return dn.forEach(e=>{l.delete(e)}),r&&l.set(`role`,r),l.set(`addresses`,o),l.set(`secret`,n),c.hash=`${u}?${l.toString()}`,c.toString()}async function mn(e,t){let n;try{n=new URL(e.trim())}catch(e){throw new J(`Pairing endpoint is not a valid URL`,{cause:e})}let{params:r}=hn(n);if(t){let e=r.get(`role`)?.trim()||void 0;if(e!==t)throw new fn(t,e)}let i=r.get(`addresses`)?.trim(),a=r.get(`secret`)?.trim();if(!i||!a)throw new J(`Pairing endpoint is incomplete`);return{addresses:await _n(i),secret:a}}function hn(e){let t=e.hash.slice(1),n=t.indexOf(`?`);return n===-1?{params:new URLSearchParams,route:t}:{params:new URLSearchParams(t.slice(n+1)),route:t.slice(0,n)}}function gn(e){return s.bytesConcat(...U(e.map(e=>e.bytes)))}async function _n(e){try{let t=await vn(s.bytesFrom(e,`base64url`),new DecompressionStream(`deflate`),q),n=[];for(let e of K([t],{maxDataLength:q})){if(n.length>=16)throw Error(`Too many addresses`);n.push(F(e.subarray()))}if(n.length===0)throw Error(`Missing addresses`);return n}catch(e){throw new J(`Pairing endpoint contains invalid compressed addresses`,{cause:e})}}async function vn(e,t,n){let r=n===void 0?t.readable:t.readable.pipeThrough(yn(n)),i=new Response(r).arrayBuffer().then(e=>({buffer:e,ok:!0}),e=>({error:e,ok:!1})),a=t.writable.getWriter();try{await a.write(Uint8Array.from(e)),await a.close()}catch(e){let t=await i;throw t.ok?e:t.error}let o=await i;if(!o.ok)throw o.error;return new Uint8Array(o.buffer)}function yn(e){let t=0;return new TransformStream({transform(n,r){if(n.byteLength>e-t)throw Error(`Decompressed address data is too large`);t+=n.byteLength,r.enqueue(n)}})}var Y=1024,bn=class{constructor(e,t){if(this.components=e,this.config=t,this.currentSecret=Dn(),this.errorListeners=new Set,this.pairedListeners=new Set,this.unpairedListeners=new Set,this.secretChangedListeners=new Set,this.pairingTimeouts=new Map,t.pairedPeerTimeoutMs<=0)throw Error(`Paired peer timeout must be greater than zero`)}get secret(){return this.currentSecret}onError(e){return this.errorListeners.add(e),()=>this.errorListeners.delete(e)}onPaired(e){return this.pairedListeners.add(e),()=>this.pairedListeners.delete(e)}onUnpaired(e){return this.unpairedListeners.add(e),()=>this.unpairedListeners.delete(e)}onSecretChanged(e){return this.secretChangedListeners.add(e),()=>this.secretChangedListeners.delete(e)}async start(){await this.components.registrar.handle(this.config.protocol,this.handleProtocol.bind(this),{runOnLimitedConnection:!0})}async stop(){await this.components.registrar.unhandle(this.config.protocol),this.pairingTimeouts.forEach(e=>clearTimeout(e)),this.pairingTimeouts.clear()}isPaired(e){return this.pairingTimeouts.has(e.toString())}refresh(e){let t=e.toString(),n=this.pairingTimeouts.get(t);n!==void 0&&(clearTimeout(n),this.pairingTimeouts.set(t,this.createPeerTimeout(e)))}async pair(e,t={}){let n,r;try{let i=await this.openStream(e.addresses,t);if(n=i.stream,!i.connection)throw Error(`Could not determine remote peer`);this.addPairedPeer(i.connection.remotePeer)&&(r=i.connection.remotePeer);let a=await Sn(n,Cn(e.secret,this.config.name),t);if(t.signal?.throwIfAborted(),n=void 0,!a.ok)throw Error(a.error);return r&&(this.rotateSecret(),this.notifyPairedPeer(r,a.name)),i.connection.remotePeer}catch(e){throw r&&this.removePairedPeer(r,!1),this.handleError(e,n)}}async unpair(e){if(!this.removePairedPeer(e))return;let t={signal:AbortSignal.timeout(1e4)},n;try{let r=await this.openStream(e,t);n=r.stream;let i=await Sn(r.stream,{type:`unpair`},t);if(n=void 0,!i.ok)throw Error(i.error)}catch(e){this.handleError(e,n)}}async handleProtocol(e,t){let n;try{let r=R(e,{maxDataLength:Y}),i=Tn((await r.read()).subarray());if(i.type===`unpair`){this.removePairedPeer(t.remotePeer),await X(r,e,{ok:!0});return}if(i.secret!==this.secret||!this.canPair(t.remotePeer)){await X(r,e,{ok:!1,error:`Pairing rejected`});return}this.rotateSecret(),this.addPairedPeer(t.remotePeer)&&(n=t.remotePeer),await X(r,e,{ok:!0,name:this.config.name}),n&&this.notifyPairedPeer(n,i.name)}catch(t){n&&this.removePairedPeer(n,!1),this.handleError(t,e)}}addPairedPeer(e){let t=e.toString(),n=this.pairingTimeouts.get(t);return n!==void 0&&clearTimeout(n),this.pairingTimeouts.set(t,this.createPeerTimeout(e)),n===void 0}notifyPairedPeer(e,t){this.pairedListeners.forEach(n=>n(e,t))}rotateSecret(){this.currentSecret=Dn(),this.secretChangedListeners.forEach(e=>e(this.currentSecret))}removePairedPeer(e,t=!0){let n=e.toString(),r=this.pairingTimeouts.get(n);return r!==void 0&&(clearTimeout(r),this.pairingTimeouts.delete(n),t&&this.unpairedListeners.forEach(t=>t(e)),!0)}createPeerTimeout(e){return setTimeout(()=>{this.components.connectionManager.getConnections(e).some(({status:e})=>e===`open`)?this.pairingTimeouts.set(e.toString(),this.createPeerTimeout(e)):this.removePairedPeer(e)},this.config.pairedPeerTimeoutMs)}async openStream(e,t){let n;return{stream:await this.components.connectionManager.openStream(e,this.config.protocol,{runOnLimitedConnection:!0,signal:t.signal,onProgress(e){e.type===`connection:opened-stream`&&(n=e.detail.connection)}}),connection:n}}handleError(e,t){let n=On(e,`Pairing operation failed`);return t?.abort(n),this.errorListeners.forEach(e=>e(n)),n}};function xn(e,t){return n=>new class extends bn{canPair(e){return t.call(this,e)}}(n,e)}async function Sn(e,t,n){let r=R(e,{maxDataLength:Y});await r.write(s.bytesFrom(JSON.stringify(t),`utf8`),{signal:n.signal}),await e.close(n);let i=En((await r.read(n)).subarray());return await e.closeRead(n),i}function Cn(e,t){let n={type:`pair`,secret:e,name:t};if(wn(n)||delete n.name,!wn(n))throw Error(`Pairing request is too large`);return n}function wn(e){return s.bytesFrom(JSON.stringify(e),`utf8`).byteLength<=Y}async function X(e,t,n){await e.write(s.bytesFrom(JSON.stringify(n),`utf8`)),await t.close()}function Tn(e){let t=JSON.parse(s.bytesTo(e,`utf8`));if(t.type===`pair`&&typeof t.secret==`string`&&t.secret)return{type:`pair`,secret:t.secret,name:typeof t.name==`string`?t.name:void 0};if(t.type===`unpair`)return{type:`unpair`};throw Error(`Invalid pairing request`)}function En(e){let t=JSON.parse(s.bytesTo(e,`utf8`));if(t.ok===!0)return{ok:!0,name:typeof t.name==`string`?t.name:void 0};if(t.ok===!1&&typeof t.error==`string`)return{ok:!1,error:t.error};throw Error(`Invalid pairing response`)}function Dn(){return s.bytesTo(crypto.getRandomValues(new Uint8Array(16)),`base64url`)}function On(e,t){return e instanceof Error?e:Error(t)}var kn=[5e3,1e4,2e4],An=class{constructor(e,t,n={}){if(this.node=e,this.options=n,this.controller=new AbortController,this.handleConnectionClose=e=>{e.detail.id===this.connection?.id&&(this.connection=void 0,this.options.onConnectionChange?.(),this.connect().catch(()=>{}))},t.length===0)throw Error(`At least one relay address is required`);this.addresses=t.map(e=>F(e.trim())),e.addEventListener(`connection:close`,this.handleConnectionClose,{signal:this.controller.signal})}connect(){if(this.controller.signal.throwIfAborted(),this.connection?.status===`open`)return Promise.resolve(this.connection);if(this.connecting)return this.connecting;this.connection=void 0;let e=s.retry(kn,async({resolve:e})=>e(await this.dialRelay()),{repeat:3e4,signal:this.controller.signal}).finally(()=>{this.connecting===e&&(this.connecting=void 0),!this.controller.signal.aborted&&!this.connection&&this.connect().catch(()=>{})});return this.connecting=e,e}async stop(){if(this.controller.signal.aborted)return;this.controller.abort();let e=this.connection;this.connection=void 0,this.options.onConnectionChange?.(),await e?.close()}async dialRelay(){let e=this.selectedAddress?[this.selectedAddress]:this.addresses,t;for(let n of e){await s.waitForAvailability(this.controller.signal);let e;try{if(e=await this.node.dial(n,{signal:s.abortSignalAny([this.controller.signal,AbortSignal.timeout(1e4)])}),this.controller.signal.throwIfAborted(),this.connection=e,e.status!==`open`)throw this.connection=void 0,Error(`Relay connection closed while dialing`);return this.selectedAddress=n,this.options.onConnectionChange?.(e),e}catch(n){t=n,await e?.close()}}throw t}},Z=Zt({JsonRpcService:()=>en,JsonRpcTransportLibp2p:()=>cn,PairingEndpointError:()=>J,PairingEndpointRoleError:()=>fn,PairingService:()=>bn,RelayConnectionController:()=>An,decodePairingEndpoint:()=>mn,dialKnownAddresses:()=>Qt,encodePairingEndpoint:()=>pn,jsonRpcService:()=>sn,pairingService:()=>xn});async function jn(){typeof Reflect.get(Promise,`withResolvers`)!=`function`&&await x(()=>import(`./with-resolvers-BdQuHq6x.js`).then(t=>e(t.default,1)),__vite__mapDeps([0,1]))}var Mn=`/nervos-ckb/khie/json-rpc/0.0.1`,Nn=`https://app.ckbccc.com/#khie`,Pn=`khie-wallet://app/connect`,Fn=`/nervos-ckb/khie/pairing/0.0.1`,In=18e5;async function Ln(e,t,n){t.throwIfAborted(),await jn(),t.throwIfAborted();let[{noise:r},{yamux:i},{circuitRelayTransport:a},{identify:o,identifyPush:s},{webRTC:c},{webSockets:l},{createLibp2p:u}]=await Promise.all([x(()=>import(`./src-MKeUudpy.js`),__vite__mapDeps([2,1,3,4,5,6,7,8,9,10,11])),x(()=>import(`./src-CSxrxj7d.js`),__vite__mapDeps([12,7,13,4,11,10,14,15,16,8])),x(()=>import(`./src-ChdVSMFa.js`),__vite__mapDeps([17,3,4,5,1,6,18,19,11,7,20,16,15,21,22,10])),x(()=>import(`./src-BS96Jf9M.js`),__vite__mapDeps([23,7,18,3,4,5,1,6,24,16,19])),x(()=>import(`./webrtc.browser-BEtgs6ZH.js`),__vite__mapDeps([25,7,3,4,5,1,6,19,13,11,10,26,22,21])),x(()=>import(`./src-BHcVFdo-.js`),__vite__mapDeps([27,7,19,4,21,22,10,11,14,15,16,5,1])),x(()=>import(`./src-DZsg7xM1.js`),__vite__mapDeps([28,1,3,4,5,6,20,11,7,16,18,24,19,21,15,26]))]);return t.throwIfAborted(),u({addresses:{listen:[`/p2p-circuit`,`/webrtc`]},peerStore:{maxAddressAge:1/0},transports:[l(),c(),a()],connectionEncrypters:[r()],streamMuxers:[i()],services:{identify:o(),identifyPush:s(),pairing:Z.pairingService({name:n,protocol:Fn,pairedPeerTimeoutMs:In},e)}})}async function Rn(e,t,n){let r;try{return r=await Ln(e,t,n),t.throwIfAborted(),new p(r,e=>e.stop())}catch(e){throw await r?.stop(),e}}var zn=1e4,Bn=[5e3,1e4,2e4],Vn=3e4,Hn=4,Un=class{constructor(e,t){this.node=e,this.peerId=t,this.listenersController=new AbortController,this.stopped=!1;let n={signal:this.listenersController.signal};e.addEventListener(`peer:disconnect`,this.handlePeerDisconnect.bind(this),n),typeof document<`u`&&document.addEventListener(`visibilitychange`,this.handleVisibilityChange.bind(this),n),this.handlePeerDisconnect()}stop(){this.stopped||(this.stopped=!0,this.cancelReconnect(),this.listenersController.abort())}handleVisibilityChange(){document.visibilityState===`visible`&&this.restartReconnect()}handlePeerDisconnect(e){(e===void 0||e.detail.equals(this.peerId))&&(this.node.services.pairing.refresh(this.peerId),this.restartReconnect())}restartReconnect(){this.cancelReconnect(),this.startReconnect()}startReconnect(){if(this.stopped||this.reconnectController)return;let e=new AbortController;this.reconnectController=e,this.reconnect(e).finally(()=>{this.reconnectController===e&&(this.reconnectController=void 0)})}cancelReconnect(){this.reconnectController?.abort(),this.reconnectController=void 0}async reconnect(e){try{await c(Bn,async({index:t,resolve:n})=>{if(await l(e.signal),this.hasRequiredConnection(t))return n(void 0);try{await Z.dialKnownAddresses(this.node,this.peerId,te([e.signal,AbortSignal.timeout(zn)]))}catch(e){if(this.hasRequiredConnection(t))return n(void 0);throw e}if(this.hasRequiredConnection(t))return n(void 0);throw Error(`Dial did not establish a connection`)},{repeat:Vn,signal:e.signal})}catch{}}hasRequiredConnection(e){return this.node.getConnections(this.peerId).some(({direct:t,status:n})=>n===`open`&&(e>=Hn||t))}},Wn={appEndpoint:``,canPair:!1,ownEndpoint:``,phase:`idle`,relayState:`idle`};function Gn(e){for(let t of e.nodeSubscriptions.splice(0))t()}async function Kn(e){Gn(e),e.connectionController?.stop();try{e.pendingSigner&&await e.pendingSigner.cleanup()}finally{try{await e.relayController?.stop()}finally{await e.nodeOwner?.dispose()}}}var qn=class{constructor(e){this.currentState=Wn,this.hasStarted=!1,this.client=e.client,this.name=e.name,this.onConnected=e.onConnected,this.onStateChange=e.onStateChange}get state(){return this.currentState}update(e){this.closing||(this.currentState={...this.currentState,...e},this.onStateChange())}beginOperation(e={}){this.update({...e,error:void 0,errorKind:void 0})}updateError(e,t={}){this.update({...t,error:f(e),errorKind:Jn(e)?`incompatible-peer`:void 0})}async start(e){if(this.hasStarted||this.closing)return;this.hasStarted=!0;let t={abortController:new AbortController,nodeSubscriptions:[]};this.resources=t;let n=t.abortController.signal;try{t.nodeOwner=await Rn(()=>!n.aborted&&!t.selectedPeer,n,this.name),n.throwIfAborted();let r=t.nodeOwner.value;this.update({canPair:!0}),this.observeNode(t,r),await this.connectRelay(e)}catch(e){this.updateError(e),await this.close()}}close(){if(this.closing)return this.closing;let e=this.resources;return this.resources=void 0,e?.abortController.abort(),this.closing=e?Kn(e):Promise.resolve(),this.closing}observeNode(e,t){let n=0,r=()=>{let e=++n,r=t.getMultiaddrs();if(r.length===0){this.update({appEndpoint:``,ownEndpoint:``});return}let i=t.services.pairing.secret;Promise.all([Z.encodePairingEndpoint(Nn,r,i,`connector`),Z.encodePairingEndpoint(Pn,r,i,`connector`)]).then(([t,r])=>{e===n&&this.update({appEndpoint:r,ownEndpoint:t})}).catch(t=>{e===n&&this.updateError(t)})};t.addEventListener(`self:peer:update`,r),e.nodeSubscriptions.push(()=>t.removeEventListener(`self:peer:update`,r),t.services.pairing.onSecretChanged(r),t.services.pairing.onError(e=>{this.updateError(e)}),t.services.pairing.onPaired(e=>{this.acceptPeer(e)})),r()}async connectRelay(e){let t=this.resources,n=t?.nodeOwner?.value;if(!n||!e||t.selectedPeer)return;let r=e.trim(),i=t.abortController.signal,a=t.relayController;this.beginOperation({relayState:`connecting`});let o;try{o=new Z.RelayConnectionController(n,[r],{onConnectionChange:e=>{t.relayController===o&&this.update({relayState:e?`connected`:`connecting`})}}),t.relayController=o,await a?.stop(),await o.connect()}catch(e){if(o&&t.relayController!==o||i.aborted)return;this.updateError(e,{relayState:`failed`})}}async pair(e){let t=this.resources,n=t?.nodeOwner?.value;if(!n||!e||this.currentState.phase!==`idle`)return!1;this.beginOperation({phase:`pairing`});let r=t.abortController.signal;try{let t=await Z.decodePairingEndpoint(e,`provider`);return await n.services.pairing.pair(t,{signal:r}),!0}catch(e){return this.updateError(e),!1}finally{t.selectedPeer||this.update({phase:`idle`})}}async acceptPeer(e){let t=this.resources,n=t?.nodeOwner?.value;if(!t||!n||t.selectedPeer)return;let r=t.abortController.signal;t.selectedPeer=e,this.beginOperation({phase:`pairing`});let i=new Z.JsonRpcTransportLibp2p(n,e,{protocol:Mn,signal:r,onResponse:()=>n.services.pairing.refresh(e)}),a;try{t.connectionController=new Un(n,e),a=await ae.new(this.client,{transport:i}),r.throwIfAborted()}catch(r){t.connectionController?.stop(),t.connectionController=void 0,t.selectedPeer=void 0,this.updateError(r,{phase:`idle`}),await n.services.pairing.unpair(e);return}t.pendingSigner={cleanup:this.createPairingCleanup(n,e,a),signer:a},await this.connectSigner()}createPairingCleanup(e,t,n){let r=()=>{};return r=e.services.pairing.onUnpaired(e=>{e.equals(t)&&(this.resources?.pendingSigner?.signer===n&&this.updateError(Error(`The wallet unpaired. Go back and pair again.`),{signer:void 0}),n.replace(),this.close())}),async()=>{r(),await e.services.pairing.unpair(t)}}retrySigner(){return this.connectSigner()}async connectSigner(){let e=this.resources,t=e?.pendingSigner,n=e?.nodeOwner,r=e?.selectedPeer;if(!e||!t||!n||!r)return;let{cleanup:i,signer:a}=t;this.beginOperation({phase:`connecting`,signer:a});let o=e.abortController.signal;try{if(await a.connect(),!await a.isConnected())throw Error(`Khie signer did not connect`);o.throwIfAborted(),Gn(e);let t=e.abortController,r=e.relayController,s=n.map(e=>e),c=e.connectionController,l=new p(s.value,async()=>{t.abort(),c?.stop();try{await i()}finally{try{await r?.stop()}finally{await s.dispose()}}}),u=new p(a,e=>e.disconnect()).map(e=>{let t=ee(e);return{wallet:t,signerInfo:new re(t.name,e)}});a.onReplaced(()=>{u.dispose().catch(()=>{}),l.dispose().catch(()=>{})}),e.pendingSigner=void 0,this.resources=void 0;try{this.onConnected(u)}catch(e){throw await u.dispose(),e}}catch(e){this.updateError(e)}}};function Jn(e){return e instanceof Z.PairingEndpointError||e instanceof Error&&e.name===`UnsupportedProtocolError`}var Yn=t({KhiePairing:()=>$}),Q=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},$=class extends r{constructor(){super(...arguments),this.isAdvancedSettingsOpen=!1,this.khieEndpoint=``,this.isScanning=!1,this.hasAttemptedToOpenApp=!1,this.qrScanned=e=>{this.khieEndpoint=e.value.trim(),this.isScanning=!1,this.pair()},this.scannerError=e=>{this.localError=`Unable to scan pairing code: ${f(e.error)}`,this.isScanning=!1}}get relayAddress(){return this.relayAddressOverride??this.defaultRelayAddress??`/dns4/relay.ckbccc.com/tcp/443/wss`}connectedCallback(){super.connectedCallback(),this.localError=void 0,this.relayAddressOverride=void 0,this.hasAttemptedToOpenApp=!1,this.session=new qn({name:this.appName,client:this.client,onConnected:e=>{this.dispatchEvent(new ne(()=>{if(e.isValid)try{this.dispatchEvent(new d(e))}finally{e.dispose().catch(()=>{})}}))},onStateChange:()=>{this.session.state.phase!==`idle`&&(this.localError=void 0,this.hasAttemptedToOpenApp=!1),this.requestUpdate()}}),this.session.start(this.relayAddress.trim())}disconnectedCallback(){super.disconnectedCallback(),this.session.close()}close(){this.isScanning=!1,this.session.close()}cancelScan(){return this.isScanning?(this.isScanning=!1,!0):!1}async pair(){let e=this.khieEndpoint.trim();e&&(this.localError=void 0,await this.session.pair(e)&&(this.khieEndpoint=``))}startScanner(){this.isScanning=!0,this.localError=void 0}connectRelay(){this.session.connectRelay(this.relayAddress.trim())}render(){let{appEndpoint:e,canPair:t,error:r,errorKind:a,ownEndpoint:o,phase:s,relayState:c,signer:l}=this.session.state,d=this.localError??r;return s===`pairing`||s===`connecting`?n`<ccc-connecting
        .name=${l?.name??`Khie`}
        .icon=${ie(l?.icon)}
        .error=${d}
        .hint=${l?`Approve the connection in Khie to continue`:`Establishing secure connection…`}
        .onRetry=${l?()=>{this.session.retrySigner()}:void 0}
      ></ccc-connecting>`:this.isScanning?n`<ccc-qr-scanner
        @qr-scanned=${this.qrScanned}
        @error=${this.scannerError}
      ></ccc-qr-scanner>`:n`
      <div class="pairing-layout">
        <section class="field pairing-side own-side">
          <label>Let a wallet scan this</label>
          <div class="endpoint-pair">
            <ccc-qr-code
              class="qr-code"
              .value=${o}
              alt="Connector pairing code"
              @error=${e=>{this.localError=f(e.error)}}
            ></ccc-qr-code>
            ${c===`failed`?n`<ccc-button-pill @click=${()=>this.connectRelay()}>
                    ${u} Try again
                  </ccc-button-pill>`:o?n`<div class="endpoint-details">
                      <div class="endpoint-actions">
                        <ccc-copy-button
                          .value=${o}
                          class="endpoint-copy"
                          title="Tap to copy pairing code"
                          aria-label="Copy connector pairing code"
                          @error=${e=>{this.localError=f(e.error)}}
                        >
                          <span>Tap to copy pairing code</span>
                        </ccc-copy-button>
                        ${e?n`<a
                                class="open-app-pill"
                                href=${e}
                                @click=${()=>{this.hasAttemptedToOpenApp=!0}}
                                >Open Wallet</a
                              >`:void 0}
                      </div>
                      ${this.hasAttemptedToOpenApp&&e?n`<span class="open-app-status" role="status"
                              >If the wallet app doesn't open, install a wallet
                              that supports Khie or pair manually.</span
                            >`:void 0}
                    </div>`:n`<span class="endpoint-pending"
                      >Connecting relay…</span
                    >`}
          </div>
        </section>

        <div class="divider" aria-hidden="true"><span>or</span></div>

        <section class="field pairing-side remote-side">
          <label>Scan wallet code</label>
          <div class="remote-actions">
            <ccc-button @click=${()=>this.startScanner()}>
              ${Yt} Scan wallet code
            </ccc-button>
            <div class="endpoint-control">
              <ccc-input
                class="endpoint-input"
                .value=${this.khieEndpoint}
                aria-label="Wallet pairing code"
                placeholder="Or paste pairing code"
                spellcheck="false"
                @input=${e=>{this.khieEndpoint=e.currentTarget.value}}
                @keydown=${e=>{e.key===`Enter`&&this.pair()}}
              ></ccc-input>
              <button
                class="endpoint-submit"
                aria-label="Connect"
                title="Connect"
                ?disabled=${!t||!this.khieEndpoint.trim()}
                @click=${()=>this.pair()}
              >
                ${oe}
              </button>
            </div>
            <p class="khie-help">
              Khie is a peer-to-peer protocol that connects wallets and
              applications.
              <a
                href=${o||`https://app.ckbccc.com/#khie`}
                target="_blank"
                rel="noopener noreferrer"
                >Learn more about Khie here</a
              >, where you can also connect a local wallet from the device where
              it is available.
            </p>
          </div>

          <button
            class="text-button advanced-toggle"
            aria-expanded=${this.isAdvancedSettingsOpen}
            aria-controls="khie-advanced-settings"
            @click=${()=>{this.isAdvancedSettingsOpen=!this.isAdvancedSettingsOpen}}
          >
            <span>Advanced settings</span>
            <span class="settings-chevron">${i}</span>
          </button>
        </section>

        ${this.isAdvancedSettingsOpen?n`<section
                class="field advanced-settings"
                id="khie-advanced-settings"
              >
                <label>Relay multiaddr</label>
                <div class="relay-control">
                  <ccc-input
                    class="relay-input"
                    .value=${this.relayAddress}
                    aria-label="Relay multiaddr"
                    placeholder="/dns4/relay.example/tcp/443/wss"
                    spellcheck="false"
                    @input=${e=>{this.relayAddressOverride=e.currentTarget.value}}
                  ></ccc-input>
                  <button
                    ?disabled=${!t||!this.relayAddress.trim()||c===`connecting`}
                    @click=${()=>this.connectRelay()}
                  >
                    ${c===`connecting`?`Connecting…`:c===`connected`?`Reconnect`:`Connect relay`}
                  </button>
                </div>
              </section>`:void 0}
      </div>
      ${d&&!this.localError&&a===`incompatible-peer`?n`<div class="compatibility-help" role="alert">
              <strong>This is not a compatible Khie pairing code</strong>
              <span>
                Scan a pairing code from a wallet.
                ${this.khieEndpoint?n`<a
                        href=${this.khieEndpoint}
                        target="_blank"
                        rel="noopener noreferrer"
                        >Go here to learn more.</a
                      >`:void 0}
              </span>
            </div>`:void 0}
      ${d&&(this.localError||a!==`incompatible-peer`)?n`<span class="error">${d}</span>`:void 0}
    `}static{this.styles=se`
    :host {
      display: flex;
      width: min(44rem, calc(100vw - 4rem));
      flex-direction: column;
      gap: 1rem;
    }

    .pairing-layout {
      display: grid;
      min-width: 0;
      grid-template-columns: minmax(0, 1fr) 2.25rem minmax(0, 1fr);
      gap: 1rem;
    }

    .field {
      display: flex;
      min-width: 0;
      flex-direction: column;
      gap: 0.5rem;
    }

    label {
      font-size: 0.85rem;
      font-weight: 600;
    }

    .pairing-side {
      min-height: 17.5rem;
    }

    .own-side {
      grid-row: 1;
      grid-column: 1;
    }

    .remote-side {
      display: grid;
      grid-row: 1;
      grid-column: 3;
      grid-template-rows: auto minmax(0, 1fr) auto;
    }

    button {
      box-sizing: border-box;
      padding: 0.65rem 0.85rem;
      border: 1px solid var(--divider);
      border-radius: 0.4rem;
      color: var(--btn-color, inherit);
      background: var(--btn-primary);
      font: inherit;
      cursor: pointer;
    }

    button:hover:not(:disabled) {
      color: var(--btn-color-hover, var(--btn-color, inherit));
      background: var(--btn-primary-hover);
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    .endpoint-input {
      min-width: 0;
      height: 2.7rem;
    }

    .endpoint-pair {
      display: grid;
      min-width: 0;
      justify-items: center;
      gap: 0.75rem;
    }

    .qr-code {
      width: min(13rem, 100%);
    }

    .endpoint-details {
      display: grid;
      width: 100%;
      min-width: 0;
      gap: 0.25rem;
    }

    .endpoint-actions {
      display: flex;
      flex-wrap: wrap;
      width: 100%;
      min-width: 0;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .open-app-pill {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 1rem;
      border-radius: 9999px;
      color: var(--btn-color, inherit);
      background: var(--btn-secondary);
      font-size: 0.72rem;
      text-decoration: none;
      transition:
        background 0.15s ease-in-out,
        color 0.15s ease-in-out;
      white-space: nowrap;
    }

    .open-app-pill:hover {
      color: var(--btn-color-hover, var(--btn-color, inherit));
      background: var(--btn-secondary-hover);
    }

    .open-app-status {
      color: var(--tip-color);
      font-size: 0.72rem;
      text-align: center;
    }

    .endpoint-pending {
      box-sizing: border-box;
      width: 100%;
      min-height: 2.7rem;
    }

    .endpoint-copy {
      box-sizing: border-box;
      display: flex;
      width: fit-content;
      max-width: 100%;
      min-width: 0;
      align-items: center;
      gap: 0.7rem;
      color: var(--btn-color, inherit);
      cursor: pointer;
      text-align: left;
      transition: color 0.15s ease-in-out;
    }

    .endpoint-copy:hover {
      color: var(--btn-color-hover, var(--btn-color, inherit));
    }

    .endpoint-copy span {
      overflow: hidden;
      font-family: monospace;
      font-size: 0.72rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .endpoint-pending {
      display: flex;
      padding: 0.65rem 0.85rem;
      align-items: center;
      justify-content: center;
      color: var(--tip-color);
      font-size: 0.8rem;
    }

    .khie-help {
      margin: 0.25rem 0 0;
      color: var(--tip-color);
      font-size: 0.72rem;
      line-height: 1.4;
    }

    .khie-help a {
      color: inherit;
      text-underline-offset: 0.15em;
      transition: color 0.15s ease-in-out;
    }

    .khie-help a:hover {
      color: var(--btn-color-hover, var(--btn-color, inherit));
    }

    .divider {
      position: relative;
      display: grid;
      grid-row: 1;
      grid-column: 2;
      color: var(--tip-color);
      font-size: 0.7rem;
      place-items: center;
      text-transform: uppercase;
    }

    .divider::before {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 50%;
      width: 1px;
      background: var(--divider);
      content: "";
    }

    .divider span {
      z-index: 1;
      padding: 0.5rem 0.25rem;
      background: var(--background);
    }

    .remote-actions {
      display: grid;
      align-content: center;
      gap: 0.5rem;
    }

    .endpoint-control,
    .relay-control {
      display: grid;
      min-width: 0;
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .endpoint-control {
      overflow: hidden;
      border: 1px solid var(--divider);
      border-radius: 0.4rem;
    }

    .endpoint-control:focus-within {
      border-color: var(--tip-color-hover, var(--tip-color));
    }

    .endpoint-input::part(input) {
      height: 100%;
      padding: 0.65rem;
      border: 0;
      border-radius: 0;
    }

    .endpoint-submit {
      display: grid;
      width: 2.7rem;
      height: 2.7rem;
      padding: 0;
      border: 0;
      border-radius: 0;
      color: var(--btn-color-hover, var(--btn-color, inherit));
      background: transparent;
      place-items: center;
    }

    .endpoint-submit:hover:not(:disabled) {
      background: transparent;
    }

    .endpoint-submit:disabled {
      color: var(--divider);
      opacity: 1;
    }

    .endpoint-submit svg {
      width: 1.3rem;
      height: 1.3rem;
    }

    .text-button {
      padding: 0;
      border: 0;
      color: var(--tip-color);
      background: transparent;
      font-size: 0.72rem;
    }

    .text-button:hover:not(:disabled) {
      color: var(--tip-color-hover, var(--tip-color));
      background: transparent;
    }

    .advanced-toggle {
      display: flex;
      align-items: center;
      justify-self: end;
      gap: 0.3rem;
    }

    .settings-chevron {
      display: grid;
      transform: rotate(-90deg);
      transition: transform 0.15s ease-in-out;
      --left-stroke-width: 2.5;
    }

    .settings-chevron svg {
      width: 0.65rem;
      height: 0.65rem;
    }

    .advanced-toggle[aria-expanded="true"] .settings-chevron {
      transform: rotate(90deg);
    }

    .advanced-settings {
      grid-row: 2;
      grid-column: 1 / -1;
      animation: advanced-settings-enter 0.2s ease-out both;
    }

    .relay-control {
      gap: 0.5rem;
    }

    .relay-input {
      min-width: 0;
      height: 100%;
    }

    .relay-input::part(input) {
      height: 100%;
      padding: 0.65rem;
      border-color: var(--divider);
      border-radius: 0.4rem;
    }

    .relay-control button {
      white-space: nowrap;
    }

    @keyframes advanced-settings-enter {
      from {
        opacity: 0;
        transform: translateY(-0.35rem);
      }
    }

    .error {
      display: block;
      color: var(--tip-color);
      font-size: 0.8rem;
      text-align: center;
    }

    .compatibility-help {
      display: grid;
      padding: 0.8rem 0.9rem;
      border: 1px solid var(--divider);
      border-radius: 0.4rem;
      gap: 0.3rem;
    }

    .compatibility-help strong {
      font-size: 0.85rem;
    }

    .compatibility-help span {
      color: var(--tip-color);
      font-size: 0.78rem;
      line-height: 1.45;
    }

    .compatibility-help a {
      color: inherit;
      text-decoration: underline;
      text-underline-offset: 0.15em;
    }

    @media (max-width: 40rem) {
      :host {
        width: min(28rem, calc(100vw - 4rem));
      }

      .qr-code {
        /* I hate Apple */
        width: min(22rem, calc(100% - 1.5rem));
        height: min(22rem, calc(100vw - 5.5rem));
      }

      .pairing-layout {
        grid-template-columns: minmax(0, 1fr);
      }

      .divider {
        height: 1.25rem;
        grid-row: 2;
        grid-column: 1;
      }

      .divider::before {
        top: 50%;
        right: 0;
        bottom: auto;
        left: 0;
        width: auto;
        height: 1px;
      }

      .divider span {
        padding: 0.25rem 0.5rem;
      }

      .remote-side {
        min-height: 11rem;
        grid-row: 3;
        grid-column: 1;
      }

      .advanced-settings {
        grid-row: 4;
      }
    }
  `}};Q([o({attribute:!1})],$.prototype,`appName`,void 0),Q([o({attribute:!1})],$.prototype,`client`,void 0),Q([o({attribute:!1})],$.prototype,`defaultRelayAddress`,void 0),Q([m()],$.prototype,`relayAddressOverride`,void 0),Q([m()],$.prototype,`isAdvancedSettingsOpen`,void 0),Q([m()],$.prototype,`khieEndpoint`,void 0),Q([m()],$.prototype,`isScanning`,void 0),Q([m()],$.prototype,`hasAttemptedToOpenApp`,void 0),Q([m()],$.prototype,`localError`,void 0),$=Q([ce(`ccc-khie-pairing`)],$);export{$ as KhiePairing,jt as a,Ft as c,F as d,C as f,Ce as g,Se as h,Tt as i,_t as l,we as m,K as n,R as o,Te as p,U as r,Mt as s,Yn as t,ut as u};