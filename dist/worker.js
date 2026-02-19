// node_modules/zxing-wasm/dist/es/share.js
var m = [
  ["Aztec", "M"],
  ["Codabar", "L"],
  ["Code39", "L"],
  ["Code93", "L"],
  ["Code128", "L"],
  ["DataBar", "L"],
  ["DataBarExpanded", "L"],
  ["DataMatrix", "M"],
  ["EAN-8", "L"],
  ["EAN-13", "L"],
  ["ITF", "L"],
  ["MaxiCode", "M"],
  ["PDF417", "M"],
  ["QRCode", "M"],
  ["UPC-A", "L"],
  ["UPC-E", "L"],
  ["MicroQRCode", "M"],
  ["rMQRCode", "M"],
  ["DXFilmEdge", "L"],
  ["DataBarLimited", "L"]
];
var O = m.map(([e]) => e);
var b = O.filter(
  (e, t) => m[t][1] === "L"
);
var L = O.filter(
  (e, t) => m[t][1] === "M"
);
function l(e) {
  switch (e) {
    case "Linear-Codes":
      return b.reduce((t, r) => t | l(r), 0);
    case "Matrix-Codes":
      return L.reduce((t, r) => t | l(r), 0);
    case "Any":
      return (1 << m.length) - 1;
    case "None":
      return 0;
    default:
      return 1 << O.indexOf(e);
  }
}
function w(e) {
  if (e === 0)
    return "None";
  const t = 31 - Math.clz32(e);
  return O[t];
}
function E(e) {
  return e.reduce((t, r) => t | l(r), 0);
}
var M = [
  "LocalAverage",
  "GlobalHistogram",
  "FixedThreshold",
  "BoolCast"
];
function x(e) {
  return M.indexOf(e);
}
var y = [
  "Unknown",
  "ASCII",
  "ISO8859_1",
  "ISO8859_2",
  "ISO8859_3",
  "ISO8859_4",
  "ISO8859_5",
  "ISO8859_6",
  "ISO8859_7",
  "ISO8859_8",
  "ISO8859_9",
  "ISO8859_10",
  "ISO8859_11",
  "ISO8859_13",
  "ISO8859_14",
  "ISO8859_15",
  "ISO8859_16",
  "Cp437",
  "Cp1250",
  "Cp1251",
  "Cp1252",
  "Cp1256",
  "Shift_JIS",
  "Big5",
  "GB2312",
  "GB18030",
  "EUC_JP",
  "EUC_KR",
  "UTF16BE",
  /**
   * UnicodeBig [[deprecated]]
   */
  "UTF16BE",
  "UTF8",
  "UTF16LE",
  "UTF32BE",
  "UTF32LE",
  "BINARY"
];
function B(e) {
  return e === "UnicodeBig" ? y.indexOf("UTF16BE") : y.indexOf(e);
}
var F = [
  "Text",
  "Binary",
  "Mixed",
  "GS1",
  "ISO15434",
  "UnknownECI"
];
function T(e) {
  return F[e];
}
var A = ["Ignore", "Read", "Require"];
function U(e) {
  return A.indexOf(e);
}
var R = ["Plain", "ECI", "HRI", "Hex", "Escaped"];
function p(e) {
  return R.indexOf(e);
}
var u = {
  formats: [],
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
  tryDownscale: true,
  tryDenoise: false,
  binarizer: "LocalAverage",
  isPure: false,
  downscaleFactor: 3,
  downscaleThreshold: 500,
  minLineCount: 2,
  maxNumberOfSymbols: 255,
  tryCode39ExtendedMode: true,
  returnErrors: false,
  eanAddOnSymbol: "Ignore",
  textMode: "HRI",
  characterSet: "Unknown"
};
function I(e) {
  return {
    ...e,
    formats: E(e.formats),
    binarizer: x(e.binarizer),
    eanAddOnSymbol: U(e.eanAddOnSymbol),
    textMode: p(e.textMode),
    characterSet: B(e.characterSet)
  };
}
function P(e) {
  return {
    ...e,
    format: w(e.format),
    contentType: T(e.contentType),
    eccLevel: e.ecLevel
  };
}
var h = {
  format: "QRCode",
  readerInit: false,
  forceSquareDataMatrix: false,
  ecLevel: "",
  scale: 0,
  sizeHint: 0,
  rotate: 0,
  withHRT: false,
  withQuietZones: true,
  options: ""
};
var W = {
  locateFile: (e, t) => {
    const r = e.match(/_(.+?)\.wasm$/);
    return r ? `https://fastly.jsdelivr.net/npm/zxing-wasm@2.2.4/dist/${r[1]}/${e}` : t + e;
  }
};
var f = /* @__PURE__ */ new WeakMap();
function D(e, t) {
  return Object.is(e, t) || Object.keys(e).length === Object.keys(t).length && Object.keys(e).every(
    (r) => Object.hasOwn(t, r) && e[r] === t[r]
  );
}
function S(e, {
  overrides: t,
  equalityFn: r = D,
  fireImmediately: d = false
} = {}) {
  var a;
  const [o, s] = (a = f.get(e)) != null ? a : [W], n = t != null ? t : o;
  let i;
  if (d) {
    if (s && (i = r(o, n)))
      return s;
    const c = e({
      ...n
    });
    return f.set(e, [n, c]), c;
  }
  (i != null ? i : r(o, n)) || f.set(e, [n]);
}
async function Z(e, t, r = u) {
  const d = {
    ...u,
    ...r
  }, o = await S(e, {
    fireImmediately: true
  });
  let s, n;
  if ("width" in t && "height" in t && "data" in t) {
    const {
      data: a,
      data: { byteLength: c },
      width: g,
      height: C
    } = t;
    n = o._malloc(c), o.HEAPU8.set(a, n), s = o.readBarcodesFromPixmap(
      n,
      g,
      C,
      I(d)
    );
  } else {
    let a, c;
    if ("buffer" in t)
      [a, c] = [t.byteLength, t];
    else if ("byteLength" in t)
      [a, c] = [t.byteLength, new Uint8Array(t)];
    else if ("size" in t)
      [a, c] = [t.size, new Uint8Array(await t.arrayBuffer())];
    else
      throw new TypeError("Invalid input type");
    n = o._malloc(a), o.HEAPU8.set(c, n), s = o.readBarcodesFromImage(
      n,
      a,
      I(d)
    );
  }
  o._free(n);
  const i = [];
  for (let a = 0; a < s.size(); ++a)
    i.push(
      P(s.get(a))
    );
  return i;
}
var j = {
  ...u,
  formats: [...u.formats]
};
var G = { ...h };

// node_modules/zxing-wasm/dist/es/reader/index.js
async function Wr(F2 = {}) {
  var O2, N2, _r, l2 = F2, ke = !!globalThis.window, Oe = typeof Bun < "u", Dr = !!globalThis.WorkerGlobalScope;
  !((N2 = globalThis.process) === null || N2 === void 0 || (N2 = N2.versions) === null || N2 === void 0) && N2.node && ((_r = globalThis.process) === null || _r === void 0 ? void 0 : _r.type) != "renderer";
  var Mr = "./this.program", je, gr = "";
  function Ee(r) {
    return l2.locateFile ? l2.locateFile(r, gr) : gr + r;
  }
  var Ur, yr;
  if (ke || Dr || Oe) {
    try {
      gr = new URL(".", je).href;
    } catch {
    }
    Dr && (yr = (r) => {
      var e = new XMLHttpRequest();
      return e.open("GET", r, false), e.responseType = "arraybuffer", e.send(null), new Uint8Array(e.response);
    }), Ur = async (r) => {
      var e = await fetch(r, {
        credentials: "same-origin"
      });
      if (e.ok)
        return e.arrayBuffer();
      throw new Error(e.status + " : " + e.url);
    };
  }
  var Ir = console.log.bind(console), x2 = console.error.bind(console), X, Vr = false, Hr, Br, U2, j2, tr, G2, q, m2, Nr, xr, zr = false;
  function Zr() {
    var r = dr.buffer;
    U2 = new Int8Array(r), tr = new Int16Array(r), l2.HEAPU8 = j2 = new Uint8Array(r), G2 = new Uint16Array(r), q = new Int32Array(r), m2 = new Uint32Array(r), Nr = new Float32Array(r), xr = new Float64Array(r);
  }
  function We() {
    if (l2.preRun)
      for (typeof l2.preRun == "function" && (l2.preRun = [l2.preRun]); l2.preRun.length; )
        Ze(l2.preRun.shift());
    Lr(Gr);
  }
  function De() {
    zr = true, rr.xa();
  }
  function Me() {
    if (l2.postRun)
      for (typeof l2.postRun == "function" && (l2.postRun = [l2.postRun]); l2.postRun.length; )
        ze(l2.postRun.shift());
    Lr(Xr);
  }
  function mr(r) {
    var e, t;
    (e = l2.onAbort) === null || e === void 0 || e.call(l2, r), r = "Aborted(" + r + ")", x2(r), Vr = true, r += ". Build with -sASSERTIONS for more info.";
    var n = new WebAssembly.RuntimeError(r);
    throw (t = Br) === null || t === void 0 || t(n), n;
  }
  var z;
  function Ue() {
    return Ee("zxing_reader.wasm");
  }
  function Ie(r) {
    if (r == z && X)
      return new Uint8Array(X);
    if (yr)
      return yr(r);
    throw "both async and sync fetching of the wasm failed";
  }
  async function Ve(r) {
    if (!X)
      try {
        var e = await Ur(r);
        return new Uint8Array(e);
      } catch {
      }
    return Ie(r);
  }
  async function He(r, e) {
    try {
      var t = await Ve(r), n = await WebAssembly.instantiate(t, e);
      return n;
    } catch (i) {
      x2(`failed to asynchronously prepare wasm: ${i}`), mr(i);
    }
  }
  async function Be(r, e, t) {
    if (!r && WebAssembly.instantiateStreaming)
      try {
        var n = fetch(e, {
          credentials: "same-origin"
        }), i = await WebAssembly.instantiateStreaming(n, t);
        return i;
      } catch (a) {
        x2(`wasm streaming compile failed: ${a}`), x2("falling back to ArrayBuffer instantiation");
      }
    return He(e, t);
  }
  function Ne() {
    var r = {
      a: Pn
    };
    return r;
  }
  async function xe() {
    function r(a, s) {
      return rr = a.exports, Tn(rr), Zr(), rr;
    }
    function e(a) {
      return r(a.instance);
    }
    var t = Ne();
    if (l2.instantiateWasm)
      return new Promise((a, s) => {
        l2.instantiateWasm(t, (o, u2) => {
          a(r(o));
        });
      });
    z != null || (z = Ue());
    var n = await Be(X, z, t), i = e(n);
    return i;
  }
  var Lr = (r) => {
    for (; r.length > 0; )
      r.shift()(l2);
  }, Xr = [], ze = (r) => Xr.push(r), Gr = [], Ze = (r) => Gr.push(r), p2 = (r) => _e(r), h2 = () => ge(), nr = [], ir = 0, Le = (r) => {
    var e = new br(r);
    return e.get_caught() || (e.set_caught(true), ir--), e.set_rethrown(false), nr.push(e), me(r), pe(r);
  }, E2 = 0, Xe = () => {
    d(0, 0);
    var r = nr.pop();
    ye(r.excPtr), E2 = 0;
  };
  class br {
    constructor(e) {
      this.excPtr = e, this.ptr = e - 24;
    }
    set_type(e) {
      m2[this.ptr + 4 >> 2] = e;
    }
    get_type() {
      return m2[this.ptr + 4 >> 2];
    }
    set_destructor(e) {
      m2[this.ptr + 8 >> 2] = e;
    }
    get_destructor() {
      return m2[this.ptr + 8 >> 2];
    }
    set_caught(e) {
      e = e ? 1 : 0, U2[this.ptr + 12] = e;
    }
    get_caught() {
      return U2[this.ptr + 12] != 0;
    }
    set_rethrown(e) {
      e = e ? 1 : 0, U2[this.ptr + 13] = e;
    }
    get_rethrown() {
      return U2[this.ptr + 13] != 0;
    }
    init(e, t) {
      this.set_adjusted_ptr(0), this.set_type(e), this.set_destructor(t);
    }
    set_adjusted_ptr(e) {
      m2[this.ptr + 16 >> 2] = e;
    }
    get_adjusted_ptr() {
      return m2[this.ptr + 16 >> 2];
    }
  }
  var ar = (r) => he(r), wr = (r) => {
    var e = E2;
    if (!e)
      return ar(0), 0;
    var t = new br(e);
    t.set_adjusted_ptr(e);
    var n = t.get_type();
    if (!n)
      return ar(0), e;
    for (var i of r) {
      if (i === 0 || i === n)
        break;
      var a = t.ptr + 16;
      if (be(i, n, a))
        return ar(i), e;
    }
    return ar(n), e;
  }, Ge = () => wr([]), qe = (r) => wr([r]), Ye = (r, e) => wr([r, e]), Ke = () => {
    var r = nr.pop();
    r || mr("no exception to throw");
    var e = r.excPtr;
    throw r.get_rethrown() || (nr.push(r), r.set_rethrown(true), r.set_caught(false), ir++), E2 = e, E2;
  }, Je = (r, e, t) => {
    var n = new br(r);
    throw n.init(e, t), E2 = r, ir++, E2;
  }, Qe = () => ir, rt = (r) => {
    throw E2 || (E2 = r), E2;
  }, et = () => mr(""), sr = {}, $r = (r) => {
    for (; r.length; ) {
      var e = r.pop(), t = r.pop();
      t(e);
    }
  };
  function Y(r) {
    return this.fromWireType(m2[r >> 2]);
  }
  var Z2 = {}, I2 = {}, or = {}, tt = class extends Error {
    constructor(e) {
      super(e), this.name = "InternalError";
    }
  }, ur = (r) => {
    throw new tt(r);
  }, V = (r, e, t) => {
    r.forEach((o) => or[o] = e);
    function n(o) {
      var u2 = t(o);
      u2.length !== r.length && ur("Mismatched type converter count");
      for (var f2 = 0; f2 < r.length; ++f2)
        S2(r[f2], u2[f2]);
    }
    var i = new Array(e.length), a = [], s = 0;
    {
      const o = e;
      for (let u2 = 0; u2 < o.length; ++u2) {
        const f2 = o[u2];
        I2.hasOwnProperty(f2) ? i[u2] = I2[f2] : (a.push(f2), Z2.hasOwnProperty(f2) || (Z2[f2] = []), Z2[f2].push(() => {
          i[u2] = I2[f2], ++s, s === a.length && n(i);
        }));
      }
    }
    a.length === 0 && n(i);
  }, nt = (r) => {
    var e = sr[r];
    delete sr[r];
    var t = e.rawConstructor, n = e.rawDestructor, i = e.fields, a = i.map((s) => s.getterReturnType).concat(i.map((s) => s.setterArgumentType));
    V([r], a, (s) => {
      var o = {};
      {
        const u2 = i;
        for (let f2 = 0; f2 < u2.length; ++f2) {
          const c = u2[f2], v2 = s[f2], y2 = c.getter, w2 = c.getterContext, P2 = s[f2 + i.length], T2 = c.setter, $ = c.setterContext;
          o[c.fieldName] = {
            read: (b2) => v2.fromWireType(y2(w2, b2)),
            write: (b2, B2) => {
              var R2 = [];
              T2($, b2, P2.toWireType(R2, B2)), $r(R2);
            },
            optional: v2.optional
          };
        }
      }
      return [{
        name: e.name,
        fromWireType: (u2) => {
          var f2 = {};
          for (var c in o)
            f2[c] = o[c].read(u2);
          return n(u2), f2;
        },
        toWireType: (u2, f2) => {
          for (var c in o)
            if (!(c in f2) && !o[c].optional)
              throw new TypeError(`Missing field: "${c}"`);
          var v2 = t();
          for (c in o)
            o[c].write(v2, f2[c]);
          return u2 !== null && u2.push(n, v2), v2;
        },
        readValueFromPointer: Y,
        destructorFunction: n
      }];
    });
  }, it = (r, e, t, n, i) => {
  }, C = (r) => {
    for (var e = ""; ; ) {
      var t = j2[r++];
      if (!t) return e;
      e += String.fromCharCode(t);
    }
  }, K = class extends Error {
    constructor(e) {
      super(e), this.name = "BindingError";
    }
  }, g = (r) => {
    throw new K(r);
  };
  function at(r, e) {
    let t = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
    var n = e.name;
    if (r || g(`type "${n}" must have a positive integer typeid pointer`), I2.hasOwnProperty(r)) {
      if (t.ignoreDuplicateRegistrations)
        return;
      g(`Cannot register type '${n}' twice`);
    }
    if (I2[r] = e, delete or[r], Z2.hasOwnProperty(r)) {
      var i = Z2[r];
      delete Z2[r], i.forEach((a) => a());
    }
  }
  function S2(r, e) {
    let t = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
    return at(r, e, t);
  }
  var st = (r, e, t, n) => {
    e = C(e), S2(r, {
      name: e,
      fromWireType: function(i) {
        return !!i;
      },
      toWireType: function(i, a) {
        return a ? t : n;
      },
      readValueFromPointer: function(i) {
        return this.fromWireType(j2[i]);
      },
      destructorFunction: null
    });
  }, ot = (r) => ({
    count: r.count,
    deleteScheduled: r.deleteScheduled,
    preservePointerOnDelete: r.preservePointerOnDelete,
    ptr: r.ptr,
    ptrType: r.ptrType,
    smartPtr: r.smartPtr,
    smartPtrType: r.smartPtrType
  }), Tr = (r) => {
    function e(t) {
      return t.$$.ptrType.registeredClass.name;
    }
    g(e(r) + " instance already deleted");
  }, Pr = false, qr = (r) => {
  }, ut = (r) => {
    r.smartPtr ? r.smartPtrType.rawDestructor(r.smartPtr) : r.ptrType.registeredClass.rawDestructor(r.ptr);
  }, Yr = (r) => {
    r.count.value -= 1;
    var e = r.count.value === 0;
    e && ut(r);
  }, J = (r) => globalThis.FinalizationRegistry ? (Pr = new FinalizationRegistry((e) => {
    Yr(e.$$);
  }), J = (e) => {
    var t = e.$$, n = !!t.smartPtr;
    if (n) {
      var i = {
        $$: t
      };
      Pr.register(e, i, e);
    }
    return e;
  }, qr = (e) => Pr.unregister(e), J(r)) : (J = (e) => e, r), ft = () => {
    let r = fr.prototype;
    Object.assign(r, {
      isAliasOf(t) {
        if (!(this instanceof fr) || !(t instanceof fr))
          return false;
        var n = this.$$.ptrType.registeredClass, i = this.$$.ptr;
        t.$$ = t.$$;
        for (var a = t.$$.ptrType.registeredClass, s = t.$$.ptr; n.baseClass; )
          i = n.upcast(i), n = n.baseClass;
        for (; a.baseClass; )
          s = a.upcast(s), a = a.baseClass;
        return n === a && i === s;
      },
      clone() {
        if (this.$$.ptr || Tr(this), this.$$.preservePointerOnDelete)
          return this.$$.count.value += 1, this;
        var t = J(Object.create(Object.getPrototypeOf(this), {
          $$: {
            value: ot(this.$$)
          }
        }));
        return t.$$.count.value += 1, t.$$.deleteScheduled = false, t;
      },
      delete() {
        this.$$.ptr || Tr(this), this.$$.deleteScheduled && !this.$$.preservePointerOnDelete && g("Object already scheduled for deletion"), qr(this), Yr(this.$$), this.$$.preservePointerOnDelete || (this.$$.smartPtr = void 0, this.$$.ptr = void 0);
      },
      isDeleted() {
        return !this.$$.ptr;
      },
      deleteLater() {
        return this.$$.ptr || Tr(this), this.$$.deleteScheduled && !this.$$.preservePointerOnDelete && g("Object already scheduled for deletion"), this.$$.deleteScheduled = true, this;
      }
    });
    const e = Symbol.dispose;
    e && (r[e] = r.delete);
  };
  function fr() {
  }
  var Cr = (r, e) => Object.defineProperty(e, "name", {
    value: r
  }), Kr = {}, Jr = (r, e, t) => {
    if (r[e].overloadTable === void 0) {
      var n = r[e];
      r[e] = function() {
        for (var i = arguments.length, a = new Array(i), s = 0; s < i; s++)
          a[s] = arguments[s];
        return r[e].overloadTable.hasOwnProperty(a.length) || g(`Function '${t}' called with an invalid number of arguments (${a.length}) - expects one of (${r[e].overloadTable})!`), r[e].overloadTable[a.length].apply(this, a);
      }, r[e].overloadTable = [], r[e].overloadTable[n.argCount] = n;
    }
  }, Qr = (r, e, t) => {
    l2.hasOwnProperty(r) ? ((t === void 0 || l2[r].overloadTable !== void 0 && l2[r].overloadTable[t] !== void 0) && g(`Cannot register public name '${r}' twice`), Jr(l2, r, r), l2[r].overloadTable.hasOwnProperty(t) && g(`Cannot register multiple overloads of a function with the same number of arguments (${t})!`), l2[r].overloadTable[t] = e) : (l2[r] = e, l2[r].argCount = t);
  }, lt = 48, ct = 57, vt = (r) => {
    r = r.replace(/[^a-zA-Z0-9_]/g, "$");
    var e = r.charCodeAt(0);
    return e >= lt && e <= ct ? `_${r}` : r;
  };
  function dt(r, e, t, n, i, a, s, o) {
    this.name = r, this.constructor = e, this.instancePrototype = t, this.rawDestructor = n, this.baseClass = i, this.getActualType = a, this.upcast = s, this.downcast = o, this.pureVirtualFunctions = [];
  }
  var Rr = (r, e, t) => {
    for (; e !== t; )
      e.upcast || g(`Expected null or instance of ${t.name}, got an instance of ${e.name}`), r = e.upcast(r), e = e.baseClass;
    return r;
  }, Fr = (r) => {
    if (r === null)
      return "null";
    var e = typeof r;
    return e === "object" || e === "array" || e === "function" ? r.toString() : "" + r;
  };
  function pt(r, e) {
    if (e === null)
      return this.isReference && g(`null is not a valid ${this.name}`), 0;
    e.$$ || g(`Cannot pass "${Fr(e)}" as a ${this.name}`), e.$$.ptr || g(`Cannot pass deleted object as a pointer of type ${this.name}`);
    var t = e.$$.ptrType.registeredClass, n = Rr(e.$$.ptr, t, this.registeredClass);
    return n;
  }
  function ht(r, e) {
    var t;
    if (e === null)
      return this.isReference && g(`null is not a valid ${this.name}`), this.isSmartPointer ? (t = this.rawConstructor(), r !== null && r.push(this.rawDestructor, t), t) : 0;
    (!e || !e.$$) && g(`Cannot pass "${Fr(e)}" as a ${this.name}`), e.$$.ptr || g(`Cannot pass deleted object as a pointer of type ${this.name}`), !this.isConst && e.$$.ptrType.isConst && g(`Cannot convert argument of type ${e.$$.smartPtrType ? e.$$.smartPtrType.name : e.$$.ptrType.name} to parameter type ${this.name}`);
    var n = e.$$.ptrType.registeredClass;
    if (t = Rr(e.$$.ptr, n, this.registeredClass), this.isSmartPointer)
      switch (e.$$.smartPtr === void 0 && g("Passing raw pointer to smart pointer is illegal"), this.sharingPolicy) {
        case 0:
          e.$$.smartPtrType === this ? t = e.$$.smartPtr : g(`Cannot convert argument of type ${e.$$.smartPtrType ? e.$$.smartPtrType.name : e.$$.ptrType.name} to parameter type ${this.name}`);
          break;
        case 1:
          t = e.$$.smartPtr;
          break;
        case 2:
          if (e.$$.smartPtrType === this)
            t = e.$$.smartPtr;
          else {
            var i = e.clone();
            t = this.rawShare(t, k.toHandle(() => i.delete())), r !== null && r.push(this.rawDestructor, t);
          }
          break;
        default:
          g("Unsupporting sharing policy");
      }
    return t;
  }
  function _t(r, e) {
    if (e === null)
      return this.isReference && g(`null is not a valid ${this.name}`), 0;
    e.$$ || g(`Cannot pass "${Fr(e)}" as a ${this.name}`), e.$$.ptr || g(`Cannot pass deleted object as a pointer of type ${this.name}`), e.$$.ptrType.isConst && g(`Cannot convert argument of type ${e.$$.ptrType.name} to parameter type ${this.name}`);
    var t = e.$$.ptrType.registeredClass, n = Rr(e.$$.ptr, t, this.registeredClass);
    return n;
  }
  var re = (r, e, t) => {
    if (e === t)
      return r;
    if (t.baseClass === void 0)
      return null;
    var n = re(r, e, t.baseClass);
    return n === null ? null : t.downcast(n);
  }, gt = {}, yt = (r, e) => {
    for (e === void 0 && g("ptr should not be undefined"); r.baseClass; )
      e = r.upcast(e), r = r.baseClass;
    return e;
  }, mt = (r, e) => (e = yt(r, e), gt[e]), lr = (r, e) => {
    (!e.ptrType || !e.ptr) && ur("makeClassHandle requires ptr and ptrType");
    var t = !!e.smartPtrType, n = !!e.smartPtr;
    return t !== n && ur("Both smartPtrType and smartPtr must be specified"), e.count = {
      value: 1
    }, J(Object.create(r, {
      $$: {
        value: e,
        writable: true
      }
    }));
  };
  function bt(r) {
    var e = this.getPointee(r);
    if (!e)
      return this.destructor(r), null;
    var t = mt(this.registeredClass, e);
    if (t !== void 0) {
      if (t.$$.count.value === 0)
        return t.$$.ptr = e, t.$$.smartPtr = r, t.clone();
      var n = t.clone();
      return this.destructor(r), n;
    }
    function i() {
      return this.isSmartPointer ? lr(this.registeredClass.instancePrototype, {
        ptrType: this.pointeeType,
        ptr: e,
        smartPtrType: this,
        smartPtr: r
      }) : lr(this.registeredClass.instancePrototype, {
        ptrType: this,
        ptr: r
      });
    }
    var a = this.registeredClass.getActualType(e), s = Kr[a];
    if (!s)
      return i.call(this);
    var o;
    this.isConst ? o = s.constPointerType : o = s.pointerType;
    var u2 = re(e, this.registeredClass, o.registeredClass);
    return u2 === null ? i.call(this) : this.isSmartPointer ? lr(o.registeredClass.instancePrototype, {
      ptrType: o,
      ptr: u2,
      smartPtrType: this,
      smartPtr: r
    }) : lr(o.registeredClass.instancePrototype, {
      ptrType: o,
      ptr: u2
    });
  }
  var wt = () => {
    Object.assign(cr.prototype, {
      getPointee(r) {
        return this.rawGetPointee && (r = this.rawGetPointee(r)), r;
      },
      destructor(r) {
        var e;
        (e = this.rawDestructor) === null || e === void 0 || e.call(this, r);
      },
      readValueFromPointer: Y,
      fromWireType: bt
    });
  };
  function cr(r, e, t, n, i, a, s, o, u2, f2, c) {
    this.name = r, this.registeredClass = e, this.isReference = t, this.isConst = n, this.isSmartPointer = i, this.pointeeType = a, this.sharingPolicy = s, this.rawGetPointee = o, this.rawConstructor = u2, this.rawShare = f2, this.rawDestructor = c, !i && e.baseClass === void 0 ? n ? (this.toWireType = pt, this.destructorFunction = null) : (this.toWireType = _t, this.destructorFunction = null) : this.toWireType = ht;
  }
  var ee = (r, e, t) => {
    l2.hasOwnProperty(r) || ur("Replacing nonexistent public symbol"), l2[r].overloadTable !== void 0 && t !== void 0 ? l2[r].overloadTable[t] = e : (l2[r] = e, l2[r].argCount = t);
  }, D2 = {}, $t = (r, e, t) => {
    r = r.replace(/p/g, "i");
    var n = D2[r];
    return n(e, ...t);
  }, te = [], _ = (r) => {
    var e = te[r];
    return e || (te[r] = e = Te.get(r)), e;
  }, Tt = function(r, e) {
    let t = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : [];
    if (r.includes("j"))
      return $t(r, e, t);
    var n = _(e), i = n(...t);
    function a(s) {
      return s;
    }
    return i;
  }, Pt = function(r, e) {
    let t = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : false;
    return function() {
      for (var n = arguments.length, i = new Array(n), a = 0; a < n; a++)
        i[a] = arguments[a];
      return Tt(r, e, i, t);
    };
  }, A2 = function(r, e) {
    r = C(r);
    function t() {
      if (r.includes("j"))
        return Pt(r, e);
      var i = _(e);
      return i;
    }
    var n = t();
    return typeof n != "function" && g(`unknown function pointer with signature ${r}: ${e}`), n;
  };
  class Ct extends Error {
  }
  var ne = (r) => {
    var e = de(r), t = C(e);
    return M2(e), t;
  }, vr = (r, e) => {
    var t = [], n = {};
    function i(a) {
      if (!n[a] && !I2[a]) {
        if (or[a]) {
          or[a].forEach(i);
          return;
        }
        t.push(a), n[a] = true;
      }
    }
    throw e.forEach(i), new Ct(`${r}: ` + t.map(ne).join([", "]));
  }, Rt = (r, e, t, n, i, a, s, o, u2, f2, c, v2, y2) => {
    c = C(c), a = A2(i, a), o && (o = A2(s, o)), f2 && (f2 = A2(u2, f2)), y2 = A2(v2, y2);
    var w2 = vt(c);
    Qr(w2, function() {
      vr(`Cannot construct ${c} due to unbound types`, [n]);
    }), V([r, e, t], n ? [n] : [], (P2) => {
      P2 = P2[0];
      var T2, $;
      n ? (T2 = P2.registeredClass, $ = T2.instancePrototype) : $ = fr.prototype;
      var b2 = Cr(c, function() {
        if (Object.getPrototypeOf(this) !== B2)
          throw new K(`Use 'new' to construct ${c}`);
        if (R2.constructor_body === void 0)
          throw new K(`${c} has no accessible constructor`);
        for (var Re = arguments.length, pr = new Array(Re), hr = 0; hr < Re; hr++)
          pr[hr] = arguments[hr];
        var Fe = R2.constructor_body[pr.length];
        if (Fe === void 0)
          throw new K(`Tried to invoke ctor of ${c} with invalid number of parameters (${pr.length}) - expected (${Object.keys(R2.constructor_body).toString()}) parameters instead!`);
        return Fe.apply(this, pr);
      }), B2 = Object.create($, {
        constructor: {
          value: b2
        }
      });
      b2.prototype = B2;
      var R2 = new dt(c, b2, B2, y2, T2, a, o, f2);
      if (R2.baseClass) {
        var W2, er;
        (er = (W2 = R2.baseClass).__derivedClasses) !== null && er !== void 0 || (W2.__derivedClasses = []), R2.baseClass.__derivedClasses.push(R2);
      }
      var oi = new cr(c, R2, true, false, false), Pe = new cr(c + "*", R2, false, false, false), Ce = new cr(c + " const*", R2, false, true, false);
      return Kr[r] = {
        pointerType: Pe,
        constPointerType: Ce
      }, ee(w2, b2), [oi, Pe, Ce];
    });
  }, Ar = (r, e) => {
    for (var t = [], n = 0; n < r; n++)
      t.push(m2[e + n * 4 >> 2]);
    return t;
  };
  function Ft(r) {
    for (var e = 1; e < r.length; ++e)
      if (r[e] !== null && r[e].destructorFunction === void 0)
        return true;
    return false;
  }
  function Sr(r, e, t, n, i, a) {
    var s = e.length;
    s < 2 && g("argTypes array size mismatch! Must at least get return value and 'this' types!");
    var o = e[1] !== null && t !== null, u2 = Ft(e), f2 = !e[0].isVoid, c = s - 2, v2 = new Array(c), y2 = [], w2 = [], P2 = function() {
      w2.length = 0;
      var T2;
      y2.length = o ? 2 : 1, y2[0] = i, o && (T2 = e[1].toWireType(w2, this), y2[1] = T2);
      for (var $ = 0; $ < c; ++$)
        v2[$] = e[$ + 2].toWireType(w2, $ < 0 || arguments.length <= $ ? void 0 : arguments[$]), y2.push(v2[$]);
      var b2 = n(...y2);
      function B2(R2) {
        if (u2)
          $r(w2);
        else
          for (var W2 = o ? 1 : 2; W2 < e.length; W2++) {
            var er = W2 === 1 ? T2 : v2[W2 - 2];
            e[W2].destructorFunction !== null && e[W2].destructorFunction(er);
          }
        if (f2)
          return e[0].fromWireType(R2);
      }
      return B2(b2);
    };
    return Cr(r, P2);
  }
  var At = (r, e, t, n, i, a) => {
    var s = Ar(e, t);
    i = A2(n, i), V([], [r], (o) => {
      o = o[0];
      var u2 = `constructor ${o.name}`;
      if (o.registeredClass.constructor_body === void 0 && (o.registeredClass.constructor_body = []), o.registeredClass.constructor_body[e - 1] !== void 0)
        throw new K(`Cannot register multiple constructors with identical number of parameters (${e - 1}) for class '${o.name}'! Overload resolution is currently only performed using the parameter count, not actual type info!`);
      return o.registeredClass.constructor_body[e - 1] = () => {
        vr(`Cannot construct ${o.name} due to unbound types`, s);
      }, V([], s, (f2) => (f2.splice(1, 0, null), o.registeredClass.constructor_body[e - 1] = Sr(u2, f2, null, i, a), [])), [];
    });
  }, ie = (r) => {
    r = r.trim();
    const e = r.indexOf("(");
    return e === -1 ? r : r.slice(0, e);
  }, St = (r, e, t, n, i, a, s, o, u2, f2) => {
    var c = Ar(t, n);
    e = C(e), e = ie(e), a = A2(i, a), V([], [r], (v2) => {
      v2 = v2[0];
      var y2 = `${v2.name}.${e}`;
      e.startsWith("@@") && (e = Symbol[e.substring(2)]), o && v2.registeredClass.pureVirtualFunctions.push(e);
      function w2() {
        vr(`Cannot call ${y2} due to unbound types`, c);
      }
      var P2 = v2.registeredClass.instancePrototype, T2 = P2[e];
      return T2 === void 0 || T2.overloadTable === void 0 && T2.className !== v2.name && T2.argCount === t - 2 ? (w2.argCount = t - 2, w2.className = v2.name, P2[e] = w2) : (Jr(P2, e, y2), P2[e].overloadTable[t - 2] = w2), V([], c, ($) => {
        var b2 = Sr(y2, $, v2, a, s);
        return P2[e].overloadTable === void 0 ? (b2.argCount = t - 2, P2[e] = b2) : P2[e].overloadTable[t - 2] = b2, [];
      }), [];
    });
  }, ae = [], H2 = [0, 1, , 1, null, 1, true, 1, false, 1], kr = (r) => {
    r > 9 && --H2[r + 1] === 0 && (H2[r] = void 0, ae.push(r));
  }, k = {
    toValue: (r) => (r || g(`Cannot use deleted val. handle = ${r}`), H2[r]),
    toHandle: (r) => {
      switch (r) {
        case void 0:
          return 2;
        case null:
          return 4;
        case true:
          return 6;
        case false:
          return 8;
        default: {
          const e = ae.pop() || H2.length;
          return H2[e] = r, H2[e + 1] = 1, e;
        }
      }
    }
  }, se = {
    name: "emscripten::val",
    fromWireType: (r) => {
      var e = k.toValue(r);
      return kr(r), e;
    },
    toWireType: (r, e) => k.toHandle(e),
    readValueFromPointer: Y,
    destructorFunction: null
  }, kt = (r) => S2(r, se), Ot = (r, e) => {
    switch (e) {
      case 4:
        return function(t) {
          return this.fromWireType(Nr[t >> 2]);
        };
      case 8:
        return function(t) {
          return this.fromWireType(xr[t >> 3]);
        };
      default:
        throw new TypeError(`invalid float width (${e}): ${r}`);
    }
  }, jt = (r, e, t) => {
    e = C(e), S2(r, {
      name: e,
      fromWireType: (n) => n,
      toWireType: (n, i) => i,
      readValueFromPointer: Ot(e, t),
      destructorFunction: null
    });
  }, Et = (r, e, t, n, i, a, s, o) => {
    var u2 = Ar(e, t);
    r = C(r), r = ie(r), i = A2(n, i), Qr(r, function() {
      vr(`Cannot call ${r} due to unbound types`, u2);
    }, e - 1), V([], u2, (f2) => {
      var c = [f2[0], null].concat(f2.slice(1));
      return ee(r, Sr(r, c, null, i, a), e - 1), [];
    });
  }, Wt = (r, e, t) => {
    switch (e) {
      case 1:
        return t ? (n) => U2[n] : (n) => j2[n];
      case 2:
        return t ? (n) => tr[n >> 1] : (n) => G2[n >> 1];
      case 4:
        return t ? (n) => q[n >> 2] : (n) => m2[n >> 2];
      default:
        throw new TypeError(`invalid integer width (${e}): ${r}`);
    }
  }, Dt = (r, e, t, n, i) => {
    e = C(e);
    const a = n === 0;
    let s = (u2) => u2;
    if (a) {
      var o = 32 - 8 * t;
      s = (u2) => u2 << o >>> o, i = s(i);
    }
    S2(r, {
      name: e,
      fromWireType: s,
      toWireType: (u2, f2) => f2,
      readValueFromPointer: Wt(e, t, n !== 0),
      destructorFunction: null
    });
  }, Mt = (r, e, t) => {
    var n = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array], i = n[e];
    function a(s) {
      var o = m2[s >> 2], u2 = m2[s + 4 >> 2];
      return new i(U2.buffer, u2, o);
    }
    t = C(t), S2(r, {
      name: t,
      fromWireType: a,
      readValueFromPointer: a
    }, {
      ignoreDuplicateRegistrations: true
    });
  }, Ut = Object.assign({
    optional: true
  }, se), It = (r, e) => {
    S2(r, Ut);
  }, Vt = (r, e, t, n) => {
    if (!(n > 0)) return 0;
    for (var i = t, a = t + n - 1, s = 0; s < r.length; ++s) {
      var o = r.codePointAt(s);
      if (o <= 127) {
        if (t >= a) break;
        e[t++] = o;
      } else if (o <= 2047) {
        if (t + 1 >= a) break;
        e[t++] = 192 | o >> 6, e[t++] = 128 | o & 63;
      } else if (o <= 65535) {
        if (t + 2 >= a) break;
        e[t++] = 224 | o >> 12, e[t++] = 128 | o >> 6 & 63, e[t++] = 128 | o & 63;
      } else {
        if (t + 3 >= a) break;
        e[t++] = 240 | o >> 18, e[t++] = 128 | o >> 12 & 63, e[t++] = 128 | o >> 6 & 63, e[t++] = 128 | o & 63, s++;
      }
    }
    return e[t] = 0, t - i;
  }, L2 = (r, e, t) => Vt(r, j2, e, t), oe = (r) => {
    for (var e = 0, t = 0; t < r.length; ++t) {
      var n = r.charCodeAt(t);
      n <= 127 ? e++ : n <= 2047 ? e += 2 : n >= 55296 && n <= 57343 ? (e += 4, ++t) : e += 3;
    }
    return e;
  }, ue = globalThis.TextDecoder && new TextDecoder(), fe = (r, e, t, n) => {
    var i = e + t;
    if (n) return i;
    for (; r[e] && !(e >= i); ) ++e;
    return e;
  }, le = function(r) {
    let e = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0, t = arguments.length > 2 ? arguments[2] : void 0, n = arguments.length > 3 ? arguments[3] : void 0;
    var i = fe(r, e, t, n);
    if (i - e > 16 && r.buffer && ue)
      return ue.decode(r.subarray(e, i));
    for (var a = ""; e < i; ) {
      var s = r[e++];
      if (!(s & 128)) {
        a += String.fromCharCode(s);
        continue;
      }
      var o = r[e++] & 63;
      if ((s & 224) == 192) {
        a += String.fromCharCode((s & 31) << 6 | o);
        continue;
      }
      var u2 = r[e++] & 63;
      if ((s & 240) == 224 ? s = (s & 15) << 12 | o << 6 | u2 : s = (s & 7) << 18 | o << 12 | u2 << 6 | r[e++] & 63, s < 65536)
        a += String.fromCharCode(s);
      else {
        var f2 = s - 65536;
        a += String.fromCharCode(55296 | f2 >> 10, 56320 | f2 & 1023);
      }
    }
    return a;
  }, Ht = (r, e, t) => r ? le(j2, r, e, t) : "", Bt = (r, e) => {
    e = C(e), S2(r, {
      name: e,
      fromWireType(t) {
        var n = m2[t >> 2], i = t + 4, a;
        return a = Ht(i, n, true), M2(t), a;
      },
      toWireType(t, n) {
        n instanceof ArrayBuffer && (n = new Uint8Array(n));
        var i, a = typeof n == "string";
        a || ArrayBuffer.isView(n) && n.BYTES_PER_ELEMENT == 1 || g("Cannot pass non-string to std::string"), a ? i = oe(n) : i = n.length;
        var s = Er(4 + i + 1), o = s + 4;
        return m2[s >> 2] = i, a ? L2(n, o, i + 1) : j2.set(n, o), t !== null && t.push(M2, s), s;
      },
      readValueFromPointer: Y,
      destructorFunction(t) {
        M2(t);
      }
    });
  }, ce = globalThis.TextDecoder ? new TextDecoder("utf-16le") : void 0, Nt = (r, e, t) => {
    var n = r >> 1, i = fe(G2, n, e / 2, t);
    if (i - n > 16 && ce) return ce.decode(G2.subarray(n, i));
    for (var a = "", s = n; s < i; ++s) {
      var o = G2[s];
      a += String.fromCharCode(o);
    }
    return a;
  }, xt = (r, e, t) => {
    if (t != null || (t = 2147483647), t < 2) return 0;
    t -= 2;
    for (var n = e, i = t < r.length * 2 ? t / 2 : r.length, a = 0; a < i; ++a) {
      var s = r.charCodeAt(a);
      tr[e >> 1] = s, e += 2;
    }
    return tr[e >> 1] = 0, e - n;
  }, zt = (r) => r.length * 2, Zt = (r, e, t) => {
    for (var n = "", i = r >> 2, a = 0; !(a >= e / 4); a++) {
      var s = m2[i + a];
      if (!s && !t) break;
      n += String.fromCodePoint(s);
    }
    return n;
  }, Lt = (r, e, t) => {
    if (t != null || (t = 2147483647), t < 4) return 0;
    for (var n = e, i = n + t - 4, a = 0; a < r.length; ++a) {
      var s = r.codePointAt(a);
      if (s > 65535 && a++, q[e >> 2] = s, e += 4, e + 4 > i) break;
    }
    return q[e >> 2] = 0, e - n;
  }, Xt = (r) => {
    for (var e = 0, t = 0; t < r.length; ++t) {
      var n = r.codePointAt(t);
      n > 65535 && t++, e += 4;
    }
    return e;
  }, Gt = (r, e, t) => {
    t = C(t);
    var n, i, a;
    e === 2 ? (n = Nt, i = xt, a = zt) : (n = Zt, i = Lt, a = Xt), S2(r, {
      name: t,
      fromWireType: (s) => {
        var o = m2[s >> 2], u2 = n(s + 4, o * e, true);
        return M2(s), u2;
      },
      toWireType: (s, o) => {
        typeof o != "string" && g(`Cannot pass non-string to C++ string type ${t}`);
        var u2 = a(o), f2 = Er(4 + u2 + e);
        return m2[f2 >> 2] = u2 / e, i(o, f2 + 4, u2 + e), s !== null && s.push(M2, f2), f2;
      },
      readValueFromPointer: Y,
      destructorFunction(s) {
        M2(s);
      }
    });
  }, qt = (r, e, t, n, i, a) => {
    sr[r] = {
      name: C(e),
      rawConstructor: A2(t, n),
      rawDestructor: A2(i, a),
      fields: []
    };
  }, Yt = (r, e, t, n, i, a, s, o, u2, f2) => {
    sr[r].fields.push({
      fieldName: C(e),
      getterReturnType: t,
      getter: A2(n, i),
      getterContext: a,
      setterArgumentType: s,
      setter: A2(o, u2),
      setterContext: f2
    });
  }, Kt = (r, e) => {
    e = C(e), S2(r, {
      isVoid: true,
      name: e,
      fromWireType: () => {
      },
      toWireType: (t, n) => {
      }
    });
  }, Or = [], Jt = (r) => {
    var e = Or.length;
    return Or.push(r), e;
  }, Qt = (r, e) => {
    var t = I2[r];
    return t === void 0 && g(`${e} has unknown type ${ne(r)}`), t;
  }, rn = (r, e) => {
    for (var t = new Array(r), n = 0; n < r; ++n)
      t[n] = Qt(m2[e + n * 4 >> 2], `parameter ${n}`);
    return t;
  }, en = (r, e, t) => {
    var n = [], i = r(n, t);
    return n.length && (m2[e >> 2] = k.toHandle(n)), i;
  }, tn = {}, ve = (r) => {
    var e = tn[r];
    return e === void 0 ? C(r) : e;
  }, nn = (r, e, t) => {
    var n = 8, [i, ...a] = rn(r, e), s = i.toWireType.bind(i), o = a.map((v2) => v2.readValueFromPointer.bind(v2));
    r--;
    var u2 = new Array(r), f2 = (v2, y2, w2, P2) => {
      for (var T2 = 0, $ = 0; $ < r; ++$)
        u2[$] = o[$](P2 + T2), T2 += n;
      var b2;
      switch (t) {
        case 0:
          b2 = k.toValue(v2).apply(null, u2);
          break;
        case 2:
          b2 = Reflect.construct(k.toValue(v2), u2);
          break;
        case 3:
          b2 = u2[0];
          break;
        case 1:
          b2 = k.toValue(v2)[ve(y2)](...u2);
          break;
      }
      return en(s, w2, b2);
    }, c = `methodCaller<(${a.map((v2) => v2.name)}) => ${i.name}>`;
    return Jt(Cr(c, f2));
  }, an = (r) => r ? (r = ve(r), k.toHandle(globalThis[r])) : k.toHandle(globalThis), sn = (r) => {
    r > 9 && (H2[r + 1] += 1);
  }, on = (r, e, t, n, i) => Or[r](e, t, n, i), un = (r) => {
    var e = k.toValue(r);
    $r(e), kr(r);
  }, fn = (r, e, t, n) => {
    var i = (/* @__PURE__ */ new Date()).getFullYear(), a = new Date(i, 0, 1), s = new Date(i, 6, 1), o = a.getTimezoneOffset(), u2 = s.getTimezoneOffset(), f2 = Math.max(o, u2);
    m2[r >> 2] = f2 * 60, q[e >> 2] = +(o != u2);
    var c = (w2) => {
      var P2 = w2 >= 0 ? "-" : "+", T2 = Math.abs(w2), $ = String(Math.floor(T2 / 60)).padStart(2, "0"), b2 = String(T2 % 60).padStart(2, "0");
      return `UTC${P2}${$}${b2}`;
    }, v2 = c(o), y2 = c(u2);
    u2 < o ? (L2(v2, t, 17), L2(y2, n, 17)) : (L2(v2, n, 17), L2(y2, t, 17));
  }, ln = () => 2147483648, cn = (r, e) => Math.ceil(r / e) * e, vn = (r) => {
    var e = dr.buffer.byteLength, t = (r - e + 65535) / 65536 | 0;
    try {
      return dr.grow(t), Zr(), 1;
    } catch {
    }
  }, dn = (r) => {
    var e = j2.length;
    r >>>= 0;
    var t = ln();
    if (r > t)
      return false;
    for (var n = 1; n <= 4; n *= 2) {
      var i = e * (1 + 0.2 / n);
      i = Math.min(i, r + 100663296);
      var a = Math.min(t, cn(Math.max(r, i), 65536)), s = vn(a);
      if (s)
        return true;
    }
    return false;
  }, jr = {}, pn = () => Mr || "./this.program", Q = () => {
    if (!Q.strings) {
      var r = (typeof navigator == "object" && navigator.language || "C").replace("-", "_") + ".UTF-8", e = {
        USER: "web_user",
        LOGNAME: "web_user",
        PATH: "/",
        PWD: "/",
        HOME: "/home/web_user",
        LANG: r,
        _: pn()
      };
      for (var t in jr)
        jr[t] === void 0 ? delete e[t] : e[t] = jr[t];
      var n = [];
      for (var t in e)
        n.push(`${t}=${e[t]}`);
      Q.strings = n;
    }
    return Q.strings;
  }, hn = (r, e) => {
    var t = 0, n = 0;
    for (var i of Q()) {
      var a = e + t;
      m2[r + n >> 2] = a, t += L2(i, a, 1 / 0) + 1, n += 4;
    }
    return 0;
  }, _n = (r, e) => {
    var t = Q();
    m2[r >> 2] = t.length;
    var n = 0;
    for (var i of t)
      n += oe(i) + 1;
    return m2[e >> 2] = n, 0;
  }, gn = (r) => 52;
  function yn(r, e, t, n, i) {
    return 70;
  }
  var mn = [null, [], []], bn = (r, e) => {
    var t = mn[r];
    e === 0 || e === 10 ? ((r === 1 ? Ir : x2)(le(t)), t.length = 0) : t.push(e);
  }, wn = (r, e, t, n) => {
    for (var i = 0, a = 0; a < t; a++) {
      var s = m2[e >> 2], o = m2[e + 4 >> 2];
      e += 8;
      for (var u2 = 0; u2 < o; u2++)
        bn(r, j2[s + u2]);
      i += o;
    }
    return m2[n >> 2] = i, 0;
  }, $n = (r) => r;
  if (ft(), wt(), l2.noExitRuntime && l2.noExitRuntime, l2.print && (Ir = l2.print), l2.printErr && (x2 = l2.printErr), l2.wasmBinary && (X = l2.wasmBinary), l2.arguments && l2.arguments, l2.thisProgram && (Mr = l2.thisProgram), l2.preInit)
    for (typeof l2.preInit == "function" && (l2.preInit = [l2.preInit]); l2.preInit.length > 0; )
      l2.preInit.shift()();
  var de, M2, Er, pe, d, he, _e, ge, ye, me, be, we, $e, dr, Te;
  function Tn(r) {
    de = r.ya, M2 = l2._free = r.za, Er = l2._malloc = r.Ba, pe = r.Ca, d = r.Da, he = r.Ea, _e = r.Fa, ge = r.Ga, ye = r.Ha, me = r.Ia, be = r.Ja, D2.viijii = r.Ka, we = D2.iiijj = r.La, D2.jiji = r.Ma, $e = D2.jiiii = r.Na, D2.iiiiij = r.Oa, D2.iiiiijj = r.Pa, D2.iiiiiijj = r.Qa, dr = r.wa, Te = r.Aa;
  }
  var Pn = {
    s: Le,
    w: Xe,
    a: Ge,
    j: qe,
    m: Ye,
    Q: Ke,
    p: Je,
    U: Qe,
    d: rt,
    ca: et,
    ta: nt,
    ba: it,
    oa: st,
    ra: Rt,
    qa: At,
    H: St,
    ma: kt,
    X: jt,
    Y: Et,
    x: Dt,
    t: Mt,
    sa: It,
    na: Bt,
    R: Gt,
    I: qt,
    ua: Yt,
    pa: Kt,
    N: nn,
    va: kr,
    D: an,
    S: sn,
    M: on,
    ia: un,
    da: fn,
    ga: dn,
    ea: hn,
    fa: _n,
    ha: gn,
    $: yn,
    V: wn,
    K: Xn,
    C: Yn,
    Z: On,
    T: ti,
    r: xn,
    b: Sn,
    E: Ln,
    ka: Jn,
    c: jn,
    ja: Qn,
    h: kn,
    i: Dn,
    q: Vn,
    P: Zn,
    v: Bn,
    F: Nn,
    L: zn,
    z: Kn,
    J: ni,
    aa: ii,
    _: ai,
    f: En,
    l: Cn,
    e: An,
    g: Fn,
    O: ei,
    k: Rn,
    la: Gn,
    o: Hn,
    B: Mn,
    u: qn,
    W: In,
    A: ri,
    n: Wn,
    G: Un,
    y: $n
  };
  function Cn(r, e) {
    var t = h2();
    try {
      _(r)(e);
    } catch (n) {
      if (p2(t), n !== n + 0) throw n;
      d(1, 0);
    }
  }
  function Rn(r, e, t, n, i) {
    var a = h2();
    try {
      _(r)(e, t, n, i);
    } catch (s) {
      if (p2(a), s !== s + 0) throw s;
      d(1, 0);
    }
  }
  function Fn(r, e, t, n) {
    var i = h2();
    try {
      _(r)(e, t, n);
    } catch (a) {
      if (p2(i), a !== a + 0) throw a;
      d(1, 0);
    }
  }
  function An(r, e, t) {
    var n = h2();
    try {
      _(r)(e, t);
    } catch (i) {
      if (p2(n), i !== i + 0) throw i;
      d(1, 0);
    }
  }
  function Sn(r, e) {
    var t = h2();
    try {
      return _(r)(e);
    } catch (n) {
      if (p2(t), n !== n + 0) throw n;
      d(1, 0);
    }
  }
  function kn(r, e, t, n) {
    var i = h2();
    try {
      return _(r)(e, t, n);
    } catch (a) {
      if (p2(i), a !== a + 0) throw a;
      d(1, 0);
    }
  }
  function On(r, e, t, n, i, a) {
    var s = h2();
    try {
      return _(r)(e, t, n, i, a);
    } catch (o) {
      if (p2(s), o !== o + 0) throw o;
      d(1, 0);
    }
  }
  function jn(r, e, t) {
    var n = h2();
    try {
      return _(r)(e, t);
    } catch (i) {
      if (p2(n), i !== i + 0) throw i;
      d(1, 0);
    }
  }
  function En(r) {
    var e = h2();
    try {
      _(r)();
    } catch (t) {
      if (p2(e), t !== t + 0) throw t;
      d(1, 0);
    }
  }
  function Wn(r, e, t, n, i, a, s, o, u2, f2, c) {
    var v2 = h2();
    try {
      _(r)(e, t, n, i, a, s, o, u2, f2, c);
    } catch (y2) {
      if (p2(v2), y2 !== y2 + 0) throw y2;
      d(1, 0);
    }
  }
  function Dn(r, e, t, n, i) {
    var a = h2();
    try {
      return _(r)(e, t, n, i);
    } catch (s) {
      if (p2(a), s !== s + 0) throw s;
      d(1, 0);
    }
  }
  function Mn(r, e, t, n, i, a, s) {
    var o = h2();
    try {
      _(r)(e, t, n, i, a, s);
    } catch (u2) {
      if (p2(o), u2 !== u2 + 0) throw u2;
      d(1, 0);
    }
  }
  function Un(r, e, t, n, i, a, s, o, u2, f2, c, v2, y2, w2, P2, T2) {
    var $ = h2();
    try {
      _(r)(e, t, n, i, a, s, o, u2, f2, c, v2, y2, w2, P2, T2);
    } catch (b2) {
      if (p2($), b2 !== b2 + 0) throw b2;
      d(1, 0);
    }
  }
  function In(r, e, t, n, i, a, s, o, u2) {
    var f2 = h2();
    try {
      _(r)(e, t, n, i, a, s, o, u2);
    } catch (c) {
      if (p2(f2), c !== c + 0) throw c;
      d(1, 0);
    }
  }
  function Vn(r, e, t, n, i, a) {
    var s = h2();
    try {
      return _(r)(e, t, n, i, a);
    } catch (o) {
      if (p2(s), o !== o + 0) throw o;
      d(1, 0);
    }
  }
  function Hn(r, e, t, n, i, a) {
    var s = h2();
    try {
      _(r)(e, t, n, i, a);
    } catch (o) {
      if (p2(s), o !== o + 0) throw o;
      d(1, 0);
    }
  }
  function Bn(r, e, t, n, i, a, s) {
    var o = h2();
    try {
      return _(r)(e, t, n, i, a, s);
    } catch (u2) {
      if (p2(o), u2 !== u2 + 0) throw u2;
      d(1, 0);
    }
  }
  function Nn(r, e, t, n, i, a, s, o) {
    var u2 = h2();
    try {
      return _(r)(e, t, n, i, a, s, o);
    } catch (f2) {
      if (p2(u2), f2 !== f2 + 0) throw f2;
      d(1, 0);
    }
  }
  function xn(r) {
    var e = h2();
    try {
      return _(r)();
    } catch (t) {
      if (p2(e), t !== t + 0) throw t;
      d(1, 0);
    }
  }
  function zn(r, e, t, n, i, a, s, o, u2) {
    var f2 = h2();
    try {
      return _(r)(e, t, n, i, a, s, o, u2);
    } catch (c) {
      if (p2(f2), c !== c + 0) throw c;
      d(1, 0);
    }
  }
  function Zn(r, e, t, n, i, a, s) {
    var o = h2();
    try {
      return _(r)(e, t, n, i, a, s);
    } catch (u2) {
      if (p2(o), u2 !== u2 + 0) throw u2;
      d(1, 0);
    }
  }
  function Ln(r, e, t, n) {
    var i = h2();
    try {
      return _(r)(e, t, n);
    } catch (a) {
      if (p2(i), a !== a + 0) throw a;
      d(1, 0);
    }
  }
  function Xn(r, e, t, n) {
    var i = h2();
    try {
      return _(r)(e, t, n);
    } catch (a) {
      if (p2(i), a !== a + 0) throw a;
      d(1, 0);
    }
  }
  function Gn(r, e, t, n, i, a, s, o) {
    var u2 = h2();
    try {
      _(r)(e, t, n, i, a, s, o);
    } catch (f2) {
      if (p2(u2), f2 !== f2 + 0) throw f2;
      d(1, 0);
    }
  }
  function qn(r, e, t, n, i, a, s, o) {
    var u2 = h2();
    try {
      _(r)(e, t, n, i, a, s, o);
    } catch (f2) {
      if (p2(u2), f2 !== f2 + 0) throw f2;
      d(1, 0);
    }
  }
  function Yn(r, e, t, n, i, a) {
    var s = h2();
    try {
      return _(r)(e, t, n, i, a);
    } catch (o) {
      if (p2(s), o !== o + 0) throw o;
      d(1, 0);
    }
  }
  function Kn(r, e, t, n, i, a, s, o, u2, f2) {
    var c = h2();
    try {
      return _(r)(e, t, n, i, a, s, o, u2, f2);
    } catch (v2) {
      if (p2(c), v2 !== v2 + 0) throw v2;
      d(1, 0);
    }
  }
  function Jn(r, e, t) {
    var n = h2();
    try {
      return _(r)(e, t);
    } catch (i) {
      if (p2(n), i !== i + 0) throw i;
      d(1, 0);
    }
  }
  function Qn(r, e, t, n, i) {
    var a = h2();
    try {
      return _(r)(e, t, n, i);
    } catch (s) {
      if (p2(a), s !== s + 0) throw s;
      d(1, 0);
    }
  }
  function ri(r, e, t, n, i, a, s, o, u2, f2) {
    var c = h2();
    try {
      _(r)(e, t, n, i, a, s, o, u2, f2);
    } catch (v2) {
      if (p2(c), v2 !== v2 + 0) throw v2;
      d(1, 0);
    }
  }
  function ei(r, e, t, n, i, a, s) {
    var o = h2();
    try {
      _(r)(e, t, n, i, a, s);
    } catch (u2) {
      if (p2(o), u2 !== u2 + 0) throw u2;
      d(1, 0);
    }
  }
  function ti(r, e, t, n) {
    var i = h2();
    try {
      return _(r)(e, t, n);
    } catch (a) {
      if (p2(i), a !== a + 0) throw a;
      d(1, 0);
    }
  }
  function ni(r, e, t, n, i, a, s, o, u2, f2, c, v2) {
    var y2 = h2();
    try {
      return _(r)(e, t, n, i, a, s, o, u2, f2, c, v2);
    } catch (w2) {
      if (p2(y2), w2 !== w2 + 0) throw w2;
      d(1, 0);
    }
  }
  function ii(r, e, t, n, i, a, s) {
    var o = h2();
    try {
      return we(r, e, t, n, i, a, s);
    } catch (u2) {
      if (p2(o), u2 !== u2 + 0) throw u2;
      d(1, 0);
    }
  }
  function ai(r, e, t, n, i) {
    var a = h2();
    try {
      return $e(r, e, t, n, i);
    } catch (s) {
      if (p2(a), s !== s + 0) throw s;
      d(1, 0);
    }
  }
  function si() {
    We();
    function r() {
      var e, t;
      l2.calledRun = true, !Vr && (De(), (e = Hr) === null || e === void 0 || e(l2), (t = l2.onRuntimeInitialized) === null || t === void 0 || t.call(l2), Me());
    }
    l2.setStatus ? (l2.setStatus("Running..."), setTimeout(() => {
      setTimeout(() => l2.setStatus(""), 1), r();
    }, 1)) : r();
  }
  var rr;
  return rr = await xe(), si(), zr ? O2 = l2 : O2 = new Promise((r, e) => {
    Hr = r, Br = e;
  }), O2;
}
async function Se(F2, O2) {
  return Z(Wr, F2, O2);
}

// src/worker.ts
var defaultOptions = {
  formats: ["QRCode"],
  tryHarder: true,
  tryInvert: true,
  tryRotate: true,
  tryDenoise: false,
  tryDownscale: true,
  maxNumberOfSymbols: 1
};
var currentOptions = { ...defaultOptions };
function mapPosition(position) {
  return [
    position.topLeft,
    position.topRight,
    position.bottomRight,
    position.bottomLeft
  ];
}
self.onmessage = async (e) => {
  const { data } = e;
  if (data.type === "configure") {
    currentOptions = { ...defaultOptions, ...data.options, formats: ["QRCode"] };
    return;
  }
  if (data.type === "decode") {
    try {
      const results = await Se(data.imageData, currentOptions);
      const mapped = results.filter((r) => r.isValid).map((r) => ({
        data: r.text,
        cornerPoints: mapPosition(r.position)
      }));
      const response = { type: "result", results: mapped };
      self.postMessage(response);
    } catch (err) {
      const response = {
        type: "error",
        message: err instanceof Error ? err.message : String(err)
      };
      self.postMessage(response);
    }
  }
};
var readyResponse = { type: "ready" };
self.postMessage(readyResponse);
//# sourceMappingURL=worker.js.map