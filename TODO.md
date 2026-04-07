# Saint Lambert (SLB) ERP Scolaire - Pure Supabase Implementation
Ultra-sécurisé, Mobile-first pour parents Bénin. React + Tailwind + Supabase (Auth/Database/Storage) + react-pdf + QR.

**STATUS**: 🚀 Plan approved. Implementing step-by-step.

## 1. BASE & AUTH ✅ In Progress
- [x] Create detailed TODO.md (this file)
- [x] Create generateSLBId.js (Frontend/utils) → Pure Firestore sequential 0001 SLB 26
- [x] Refactor Login.jsx → Dual-mode w/ Royal/Gold theme, parent matricule+nom (anon + sim claims)
- [ ] Update AuthContext.jsx → Enhanced parent claims handling
- [x] Tailwind theme Royal Blue #1e3a8a / Gold #d4af37
- [ ] Frontend: npm i framer-motion @react-pdf/renderer qrcode.react recharts lucide-react clsx tailwind-merge
- [ ] Tailwind: Royal Blue (#1e3a8a)/Gold (#d4af37) theme

## 2. SECURITY & RULES
- [ ] Firestore.rules → Strict: parent read own student, prof write assigned classes
- [ ] Upload rules: firebase deploy --only firestore:rules
- [ ] QR Verify page: /verify/[bulletin_id] → Public Firestore read

## 3. CORE COMPONENTS
- [ ] GradeCalculator.js → Moyennes pondérées, rangs, coeffs
- [ ] SecureBulletin.jsx → PDF w/ watermark, header, QR(link saintlambert.bj/verify/[id])
- [ ] ParentDashboard → Real-time child data, alerts (<10), bulletin viewer

## 4. PORTALS
- [ ] Admin: Classes/matieres/coeffs/enrollement (+matricule auto)
- [ ] Teacher: Notes grid, Cahier texte, Appel numérique
- [ ] Mobile Bottom Nav (parents)

## 5. POLISH & DEPLOY
- [ ] Animations (Framer), Skeletons, Perf
- [ ] Seed demo data
- [ ] Firebase deploy (hosting + functions if needed)
- [ ] Test: Login parent, gen bulletin, QR verify

**Next**: User run `cd Frontend && npm install framer-motion @react-pdf/renderer qrcode.react recharts lucide-react clsx tailwind-merge`
**Track**: Update [x] after each tool success.

