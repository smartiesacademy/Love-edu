(function () {
  const THEME_KEY = "current_theme";
  const FONT_KEY = "current_font";
  const CUSTOM_CONFIG_KEY = "custom_theme_config";
  const DEFAULT_THEME = "vapor";
  
  const STEALTH_KEY = "TEXTSTEALTH";
  const ZWSP = '\u200B';

  const CHAR_MAPS = {
    L1: {
      'A':'А','B':'В','C':'С','E':'Е','H':'Н','I':'Ι','J':'Ј','K':'Κ','M':'М',
      'N':'Ν','O':'О','P':'Р','S':'Ѕ','T':'Т','X':'Х','Y':'Υ','Z':'Ζ',
      'a':'а','c':'с','e':'е','i':'і','j':'ј','o':'о','p':'р','s':'ѕ','x':'х','y':'у'
    },
    L2: {
      'A':'Ꭺ','B':'Ᏼ','C':'Ꮯ','D':'Ꭰ','E':'Ꭼ','G':'Ꮐ','H':'Ꮋ','K':'Ꮶ',
      'L':'Ꮮ','M':'Ꮇ','O':'Ꮎ','P':'Ꮲ','R':'Ꮢ','S':'Ꮪ','T':'Ꭲ','W':'Ꮃ',
      'a':'ɑ','b':'ƅ','d':'ԁ','g':'ɡ','h':'һ','l':'ӏ','n':'ո','q':'զ','r':'г'
    },
    L3: {
      'D':'Ꭰ','F':'Ғ','L':'Ꮮ','Q':'Ԛ','U':'Ս','V':'Ѵ',
      'f':'ғ','k':'κ','m':'м','t':'т','u':'ս','v':'ѵ','w':'ѡ','z':'ᴢ'
    }
  };

  window.applyVtheme = () => {
    return new Promise((resolve) => {
      const theme = localStorage.getItem(THEME_KEY) || DEFAULT_THEME;
      const root = document.documentElement;
      const vars = ["--bg","--secondary-bg","--third-bg","--fourth-bg","--primary","--secondary","--text-color","--secondary-text-color","--button-bg","--button-hover","--gradient-start","--gradient-end","--accent","--cb","--bc"];

      const finalize = () => {
        window.dispatchEvent(new CustomEvent("vthemechanged")); 
        resolve();
      };

      if (theme === "custom") {
        const customConfig = JSON.parse(localStorage.getItem(CUSTOM_CONFIG_KEY) || "{}");
        vars.forEach((v) => { if (customConfig[v]) root.style.setProperty(v, customConfig[v]); });
        root.setAttribute("data-theme", "custom");
        finalize();
        return;
      }

      vars.forEach((v) => root.style.removeProperty(v));
      const isAlt = localStorage.getItem("is_alt_theme") === "true";
      const themePath = `/style/${isAlt ? "alt-theme" : "theme"}/${theme}.css`;
      document.documentElement.setAttribute("data-theme", theme);

      let themeLink = document.getElementById("theme-link");
      if (!themeLink) {
        themeLink = document.createElement("link");
        themeLink.id = "theme-link";
        themeLink.rel = "stylesheet";
        document.head.appendChild(themeLink);
      }
      const timeout = setTimeout(finalize, 300); 
      themeLink.onload = finalize;
      themeLink.onerror = finalize;
      themeLink.href = themePath;
    });
  };

  window.applyVfont = () => {
    const fontName = localStorage.getItem(FONT_KEY);
    let styleEl = document.getElementById("dynamic-font-style");
    if (!fontName || fontName.trim() === "" || fontName.toLowerCase() === "default") {
      if (styleEl) styleEl.remove();
      return;
    }
    const fontUrl = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g,"+")}:wght@400;700&display=swap`;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "dynamic-font-style";
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = `@import url('${fontUrl}'); * { font-family: '${fontName}', sans-serif !important; }`;
  };

  const textNodeMap = new WeakMap(); 
  let stealthObserver = null;
  const IGNORE_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'CODE', 'PRE']);

  function getCombinedMap(level) {
    const map = {};
    if (level >= 1) Object.assign(map, CHAR_MAPS.L1);
    if (level >= 2) Object.assign(map, CHAR_MAPS.L2);
    if (level >= 3) Object.assign(map, CHAR_MAPS.L3);
    return map;
  }

  function obfuscateText(text, level) {
    if (level <= 0 || !text) return text;
    const map = getCombinedMap(level);
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      result += map[char] || char;
      if (level >= 4 && i > 0 && i % 5 === 0 && /\S/.test(char)) {
        result += ZWSP;
      }
    }
    return result;
  }

  function deobfuscateText(text) {
    if (!text) return text;
    let result = text.replace(/[\u200B\u200C\u200D]/g, '');
    const reverseMap = {};
    [CHAR_MAPS.L1, CHAR_MAPS.L2, CHAR_MAPS.L3].forEach(m => {
      Object.entries(m).forEach(([orig, sub]) => reverseMap[sub] = orig);
    });
    let final = '';
    for (const char of result) final += reverseMap[char] || char;
    return final;
  }

  function applyStealthFont(active) {
    const fontId = "stealth-unicode-font";
    if (active) {
      if (!document.getElementById(fontId)) {
        const link = document.createElement('link');
        link.id = fontId;
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&display=swap';
        document.head.appendChild(link);
      }
      document.documentElement.style.setProperty('--stealth-font', "'Noto Sans', sans-serif");
    } else {
      document.documentElement.style.removeProperty('--stealth-font');
    }
  }

  function processTextNode(node, level) {
    if (!node.parentNode || IGNORE_TAGS.has(node.parentNode.tagName)) return;
    if (!node.textContent || !node.textContent.trim()) return;

    let entry = textNodeMap.get(node);
    if (!entry) {
      entry = { original: node.textContent, level: 0 };
      textNodeMap.set(node, entry);
    }

    if (level > 0) {
      const obfuscated = obfuscateText(entry.original, level);
      if (node.textContent !== obfuscated) node.textContent = obfuscated;
      entry.level = level;
    } else if (entry.level > 0) {
      if (node.textContent !== entry.original) node.textContent = entry.original;
      entry.level = 0;
    }
  }

  function walkNodes(root, callback) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) callback(node);
    
    const all = root.querySelectorAll ? root.querySelectorAll('*') : [];
    all.forEach(el => {
      if (el.shadowRoot) walkNodes(el.shadowRoot, callback);
    });
  }

  window.applyVstealth = () => {
    let lvl = parseInt(localStorage.getItem(STEALTH_KEY) || "3");
    applyStealthFont(lvl > 0);

    const nodes = [];
    walkNodes(document.body || document.documentElement, (n) => nodes.push(n));

    let index = 0;
    const chunkSize = 100;
    function doChunk() {
      const end = Math.min(index + chunkSize, nodes.length);
      for (let i = index; i < end; i++) processTextNode(nodes[i], lvl);
      index = end;
      if (index < nodes.length) requestAnimationFrame(doChunk);
    }
    if (nodes.length > 0) requestAnimationFrame(doChunk);

    if (!stealthObserver) initStealthObserver();
  };

  function initStealthObserver() {
    stealthObserver = new MutationObserver((mutations) => {
      const lvl = parseInt(localStorage.getItem(STEALTH_KEY) || "3");
      mutations.forEach(m => {
        if (m.type === 'childList') {
          m.addedNodes.forEach(node => {
            if (node.nodeType === 3) processTextNode(node, lvl);
            else if (node.nodeType === 1) {
              walkNodes(node, (n) => processTextNode(n, lvl));
              if (node.shadowRoot) walkNodes(node.shadowRoot, (n) => processTextNode(n, lvl));
            }
          });
        } else if (m.type === 'characterData') {
          const node = m.target;
          let entry = textNodeMap.get(node);
          const expected = obfuscateText(entry?.original, lvl);
          if (node.textContent !== expected) {
            const newOrig = deobfuscateText(node.textContent);
            textNodeMap.set(node, { original: newOrig, level: lvl });
            processTextNode(node, lvl);
          }
        }
      });
    });

    stealthObserver.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true
    });
  }

  applyVtheme();
  applyVfont();
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyVstealth);
  } else {
    applyVstealth();
  }

window.forceStealthSync = (element) => {
    const lvl = parseInt(localStorage.getItem(STEALTH_KEY) || "3");
    if (lvl <= 0) return;
    
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) {
        processTextNode(node, lvl); 
    }
};

  window.addEventListener("storage", (e) => {
    if (e.key === THEME_KEY || e.key === CUSTOM_CONFIG_KEY) applyVtheme();
    if (e.key === FONT_KEY) applyVfont();
    if (e.key === STEALTH_KEY) applyVstealth();
  });
})();
