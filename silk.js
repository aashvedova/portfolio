// Lit surfaces drawn in one fragment shader behind a block: [data-silk="silk|liquid|waves"].
// Height comes from noise; normals from its gradient give the 3D shading; the light follows the cursor.
//   silk   — soft folding fabric (home intro)
//   liquid — slow, large, glossy folds like brushed liquid metal
//   waves  — long flowing ridges, like satin bands
// DPR is capped, phones render at lower resolution, each surface pauses off screen,
// and reduced motion draws a single still frame. Without WebGL the block keeps its flat colour.
(function () {
  var MODES = { silk: 0, liquid: 1, waves: 2 };
  var small = window.matchMedia('(max-width: 900px)').matches;
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var scale = Math.min(window.devicePixelRatio || 1, 1.5) * (small ? 0.5 : 0.75);

  var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var fs = [
    'precision mediump float;',
    'uniform vec2 r;uniform float t;uniform vec2 m;uniform float dark;uniform int mode;uniform float seed;',
    'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);',
    ' return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}',
    'float H(vec2 p){',
    ' p+=seed;',
    ' if(mode==1){vec2 q=vec2(fbm(p*.6+vec2(0.,t*.03)),fbm(p*.6+vec2(4.1,2.7)-t*.025));return fbm(p*.55+1.6*q);}',
    ' if(mode==2){float w=fbm(p*vec2(.6,1.2)+vec2(t*.04,0.));return .5+.5*sin(p.y*5.5+w*6.+t*.15);}',
    ' vec2 q=vec2(fbm(p+vec2(0.,t*.05)),fbm(p+vec2(5.2,1.3)-t*.04));return fbm(p+2.2*q);}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/r;vec2 p=uv*vec2(r.x/r.y,1.)*1.6;',
    ' float e=.004;float c=H(p);',
    ' float k=mode==2?.5:(mode==1?2.2:1.6);',
    ' vec3 nor=normalize(vec3(H(p-vec2(e,0.))-H(p+vec2(e,0.)),H(p-vec2(0.,e))-H(p+vec2(0.,e)),e*k));',
    ' vec3 L=normalize(vec3(m.x-.5,m.y-.5,.55));',
    ' float dif=clamp(dot(nor,L),0.,1.);',
    ' float sp=mode==1?40.:18.;',
    ' float spec=pow(clamp(dot(reflect(-L,nor),vec3(0,0,1)),0.,1.),sp);',
    ' vec3 lo=mix(vec3(.80,.81,.81),vec3(.06,.06,.06),dark);',
    ' vec3 hi=mix(vec3(.985,.985,.98),vec3(.20,.20,.195),dark);',
    ' vec3 warm=mix(vec3(.93,.91,.88),vec3(.16,.15,.14),dark);',
    ' vec3 col=mix(lo,hi,smoothstep(.05,.95,dif));',
    ' col=mix(col,warm,smoothstep(.55,.8,c)*.35);',
    ' col+=spec*mix(mode==1?.22:.10,.06,dark);',
    ' col=mix(col,hi,mode==2?.45:.35);',
    ' gl_FragColor=vec4(col,1.);}'
  ].join('\n');

  function surface(host, idx) {
    if (host.querySelector('canvas.silk')) return;
    var canvas = document.createElement('canvas');
    canvas.className = 'silk';
    canvas.setAttribute('aria-hidden', 'true');
    var gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return;
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    var pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    live.push({ canvas: canvas, gl: gl });
    host.classList.add('has-silk');
    host.insertBefore(canvas, host.firstChild);
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var u = {};
    ['r', 't', 'm', 'dark', 'mode', 'seed'].forEach(function (k) { u[k] = gl.getUniformLocation(pr, k); });
    gl.uniform1i(u.mode, MODES[host.getAttribute('data-silk')] || 0);
    gl.uniform1f(u.seed, idx * 3.7);

    function size() {
      var w = Math.max(1, Math.round(host.clientWidth * scale)), hgt = Math.max(1, Math.round(host.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== hgt) { canvas.width = w; canvas.height = hgt; gl.viewport(0, 0, w, hgt); }
    }
    var mouse = [0.75, 0.8], target = [0.75, 0.8];
    // A fixed backdrop ignores the pointer, so it follows the cursor over the whole window
    (host.classList.contains('backdrop') ? window : host).addEventListener('pointermove', function (e) {
      if (!canvas.isConnected) return;
      var b = host.getBoundingClientRect();
      target = [(e.clientX - b.left) / b.width, 1 - (e.clientY - b.top) / b.height];
    });
    var visible = false, raf = 0, t0 = performance.now();
    function frame(now) {
      if (!canvas.isConnected) { raf = 0; return; }
      size();
      mouse[0] += (target[0] - mouse[0]) * 0.05; mouse[1] += (target[1] - mouse[1]) * 0.05;
      gl.uniform2f(u.r, canvas.width, canvas.height);
      gl.uniform1f(u.t, still ? 12.0 : (now - t0) / 1000);
      gl.uniform2f(u.m, mouse[0], mouse[1]);
      gl.uniform1f(u.dark, document.documentElement.getAttribute('data-theme') === 'dark' ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      canvas.classList.add('is-on');
      raf = (!still && visible && !document.hidden) ? requestAnimationFrame(frame) : 0;
    }
    function wake() { if (!raf && visible && !document.hidden && canvas.isConnected) raf = requestAnimationFrame(frame); }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; wake(); }, { rootMargin: '100px' }).observe(host);
    } else { visible = true; wake(); }
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('resize', function () { if (!raf) frame(performance.now()); });
    new MutationObserver(function () { if (!raf) frame(performance.now()); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  // Runs on load and again after the site swaps in a new page without reloading (site.js)
  var live = [];
  window.silkInit = function () {
    // Free the GL contexts of surfaces whose page was swapped out
    live = live.filter(function (x) { if (x.canvas.isConnected) return true; var ext = x.gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); return false; });
    // Case pages stay flat: blocks marked .wide never get a shader, even if a case still carries data-silk. Requested by the owner.
    Array.prototype.forEach.call(document.querySelectorAll('[data-silk]:not(.wide)'), surface);
  };
  window.silkInit();
})();
