/** All user-facing Hebrew strings, centralized. */
export const he = {
  appName: 'איפוס מהיר',
  footer: 'כל הזכויות שמורות ל: סטס מ. | גדחה״ן 710 | 2026',

  home: {
    tagline: 'מחשבון קליקים לאיפוס על מטרת 25 מ׳',
    newZero: 'איפוס חדש',
    history: 'היסטוריה',
    lastSession: 'איפוס אחרון',
    offlineReady: 'מותקן — עובד ללא אינטרנט',
  },

  profiles: {
    title: 'בחר כוונת',
    addNew: '+ כוונת חדשה',
    estimated: 'משוער',
    fromSpec: 'לפי מפרט',
    edit: 'עריכה',
    view: 'צפייה בהגדרות',
    viewTitle: 'הגדרות הכוונת',
    builtInReadOnly: 'כוונת מובנית — לצפייה בלבד. להגדרות משלך צור כוונת חדשה.',
    editTitle: 'עריכת כוונת',
    newTitle: 'כוונת חדשה',
    name: 'שם הכוונת',
    kind: 'סוג',
    reflex: 'רפלקס / אופטית',
    iron: 'כוונות ברזל',
    elevationCmPerClick: 'ס״מ לקליק — גובה (ב־25 מ׳)',
    windageCmPerClick: 'ס״מ לקליק — צד (ב־25 מ׳)',
    desiredOffsetUp: 'היסט מטרה אנכי (ס״מ, שלילי = מתחת לנקודת הכיוון)',
    instructionsTitle: 'הוראות סיבוב (מוצגות בתוצאה)',
    instrUp: 'להזזת הפגיעה למעלה',
    instrDown: 'להזזת הפגיעה למטה',
    instrLeft: 'להזזת הפגיעה שמאלה',
    instrRight: 'להזזת הפגיעה ימינה',
    moaHelper: '1 MOA ב־25 מ׳ ≈ 0.73 ס״מ · 0.1 מיל ב־25 מ׳ = 0.25 ס״מ',
    save: 'שמור',
    cancel: 'ביטול',
    resetDefault: 'שחזר ברירת מחדל',
    delete: 'מחק כוונת',
  },

  target: {
    title: 'מטרה',
    takePhoto: 'צלם מטרה',
    schematic: 'ללא תמונה — מטרה סכמטית',
    tip: 'המטרה מודפסת על דף A4 — קנה המידה מחושב אוטומטית',
  },

  camera: {
    title: 'צילום מטרה',
    align: 'יישר את גבולות דף ה־A4 למסגרת',
    pageLocked: 'הדף זוהה — אפשר לצלם',
    pageLockedHint: 'קנה המידה נקבע לפי גבולות הדף שזוהו, גם בזווית ובלי יישור מדויק',
    capture: 'צלם',
    portrait: 'דף לאורך',
    landscape: 'דף לרוחב',
    volumeHint: 'במכשירים נתמכים אפשר לצלם גם בלחיצה על כפתור ווליום',
    starting: 'מפעיל מצלמה…',
    error: 'המצלמה הפנימית לא זמינה או שהצילום נכשל',
    fallback: 'צלם עם מצלמת המכשיר',
    autoPageDetect: 'סימון דף אוטומטי',
    autoHitDetect: 'זיהוי פגיעות אוטומטי',
  },

  appError: {
    title: 'משהו השתבש',
    reload: 'טען מחדש',
  },

  corners: {
    title: 'סימון פינות הדף',
    instruction: 'הקש על 4 פינות דף ה־A4 (בכל סדר)',
    count: (n: number) => `${n}/4 פינות`,
    detected: 'הפינות זוהו אוטומטית — בטל וסמן מחדש אם צריך',
    invalid: 'הפינות לא מגדירות מרובע תקין — סמן מחדש',
    manual: 'הדף אינו A4? כיול ידני',
    next: 'המשך',
    redo: 'סמן מחדש',
    undo: 'בטל אחרון',
  },

  aim: {
    title: 'נקודת הכיוון',
    instruction: 'הקש על הנקודה שאליה כיוונת',
    next: 'המשך',
    redo: 'סמן מחדש',
  },

  calibrate: {
    title: 'כיול קנה מידה',
    stepPoints: 'הקש על שתי נקודות במרחק ידוע (למשל קצוות של משבצת)',
    stepAim: 'הקש על נקודת הכיוון (הנקודה שאליה כיוונת)',
    distanceLabel: 'המרחק בין הנקודות',
    presetSquare: 'משבצת — 1 ס״מ',
    preset10: '10 ס״מ',
    customCm: 'ס״מ',
    tooClose: 'הנקודות קרובות מדי — הקש שוב, אפשר להתקרב עם זום',
    badDistance: 'מרחק לא תקין',
    next: 'המשך',
    redo: 'סמן מחדש',
  },

  hits: {
    title: 'סמן פגיעות',
    instruction: 'הקש על כל פגיעה בצרור. הקשה על סימון קיים — החרגה או מחיקה.',
    count: (n: number) => `${n} פגיעות`,
    excludedCount: (n: number) => `${n} מוחרגות`,
    undo: 'בטל אחרון',
    compute: 'חשב איפוס',
    autoDetected: (n: number) =>
      n === 1
        ? 'זוהתה פגיעה אחת אוטומטית — בדוק ותקן אם צריך'
        : `זוהו ${n} פגיעות אוטומטית — בדוק ותקן אם צריך`,
    fewHitsWarning: 'מומלץ צרור של 3–5 כדורים',
    exclude: 'החרג פגיעה',
    include: 'החזר פגיעה',
    remove: 'מחק',
    aimPoint: 'נקודת כיוון',
    selectedHit: (n: number) => `פגיעה ${n}:`,
  },

  result: {
    title: 'תוצאת האיפוס',
    elevation: 'גובה',
    windage: 'צד',
    zeroed: 'מאופס',
    allZeroed: 'הנשק מאופס!',
    clicks: 'קליקים',
    /** '1' reads as 'קליק אחד', otherwise 'N קליקים'. */
    clicksCount: (n: number) => (n === 1 ? 'קליק אחד' : `${n} קליקים`),
    /** Sign-aware: negative right reads שמאלה, negative up reads למטה. */
    offset: (rightCm: number, upCm: number) => {
      const r = `${Math.abs(rightCm).toFixed(1)} ס״מ ${rightCm < 0 ? 'שמאלה' : 'ימינה'}`
      const u = `${Math.abs(upCm).toFixed(1)} ס״מ ${upCm < 0 ? 'למטה' : 'למעלה'}`
      return `סטייה: ${r} · ${u}`
    },
    spread: (cm: string) => `גודל מקבץ: ${cm} ס״מ`,
    save: 'שמור ואיפוס נוסף',
    again: 'איפוס נוסף',
    saved: 'נשמר!',
    saving: 'מכין תמונה…',
    saveFailed: 'השמירה נכשלה — אין מקום באחסון המכשיר',
    cannotCompute: 'אי אפשר לחשב איפוס — חסרים נתונים:',
    missingProfile: 'לא נבחרה כוונת',
    missingScale: 'כיול קנה המידה חסר או פגום',
    missingAim: 'לא סומנה נקודת כיוון',
    missingHits: 'לא סומנו פגיעות',
    restartTarget: 'התחל מטרה מחדש',
    showPhoto: 'הצג את הצילום עם הסימונים',
    diagramTitle: 'איפה מכוונים בכוונת',
    turnClicks: (n: number) => (n === 1 ? 'סובב קליק אחד' : `סובב ${n} קליקים`),
    impactMoves: 'הפגיעה תזוז',
    dirUp: 'למעלה',
    dirDown: 'למטה',
    dirLeft: 'שמאלה',
    dirRight: 'ימינה',
  },

  history: {
    title: 'היסטוריה',
    empty: 'אין עדיין איפוסים שמורים',
    clearAll: 'מחק הכל',
    clearConfirm: 'למחוק את כל ההיסטוריה?',
    delete: 'מחק',
    hits: (n: number) => `${n} פגיעות`,
    localOnly: 'ההיסטוריה נשמרת במכשיר זה בלבד',
    export: 'ייצוא לקובץ (HTML)',
    exportFilename: 'איפוס-מהיר-היסטוריה.html',
  },

  common: {
    back: 'חזרה',
    close: 'סגור',
  },
} as const
