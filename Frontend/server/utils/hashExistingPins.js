/**
 * ============================================================
 * HASH DES PINS EXISTANTS (FIND-004 — complément hardening_phase2)
 * ============================================================
 * CONTEXTE :
 *   À partir de admin.js (phase 2), les PINs sont hashés (bcrypt,
 *   coût 12) à la création et au reset. Les PINs créés AVANT cette
 *   date sont encore en clair dans students.pin_code. Ce script
 *   les hash en une fois.
 *
 * IMPORTANT — CE QUE CE SCRIPT NE FAIT PAS :
 *   - Il ne touche PAS aux mots de passe Supabase Auth des parents.
 *     Le login parent utilise Auth (signInWithPassword), pas la
 *     colonne pin_code. Donc AUCUN parent ne perd l'accès.
 *   - Les PINs déjà hashés (commencent par $2a$/$2b$/$2y$) sont
 *     ignorés — le script est ré-exécutable sans risque.
 *
 * UTILISATION (depuis Ecole/Frontend) :
 *   node server/utils/hashExistingPins.js            → DRY-RUN (simulation, rien n'est écrit)
 *   node server/utils/hashExistingPins.js --apply    → application réelle
 *
 * VARIABLES D'ENV REQUISES (dans server/.env ou ../.env) :
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * ============================================================
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans les variables d\'environnement.');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const BCRYPT_ROUNDS = 12; // identique à admin.js
const PAUSE_MS = 150;     // pause entre chaque update pour ménager la DB

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Un hash bcrypt valide commence par $2a$, $2b$ ou $2y$ + coût
const BCRYPT_RE = /^\$2[aby]\$\d{2}\$/;
const isHashed = (pin) => BCRYPT_RE.test(pin || '');

(async () => {
  console.log('==========================================================');
  console.log(`  Hash des PINs parents — mode : ${APPLY ? '🔧 APPLY (écriture réelle)' : '👀 DRY-RUN (aucune écriture)'}`);
  console.log('==========================================================\n');

  // 1. Récupérer tous les élèves avec un PIN (le service_role voit tout, RLS non applicable)
  const { data: students, error } = await supabase
    .from('students')
    .select('id, matricule, nom, prenom, pin_code')
    .not('pin_code', 'is', null);

  if (error) {
    console.error('❌ Erreur de lecture de students :', error.message);
    process.exit(1);
  }

  const total = students.length;
  const toHash = students.filter(s => !isHashed(s.pin_code));
  const alreadyHashed = total - toHash.length;

  console.log(`📊 Élèves avec un PIN en base : ${total}`);
  console.log(`   ✅ Déjà hashés (ignorés)  : ${alreadyHashed}`);
  console.log(`   ⚠️  En clair (à hasher)   : ${toHash.length}\n`);

  if (toHash.length === 0) {
    console.log('🎉 Rien à faire — tous les PINs sont déjà hashés.');
    process.exit(0);
  }

  if (!APPLY) {
    console.log('👀 Aperçu des 10 premiers élèves concernés :');
    toHash.slice(0, 10).forEach(s => {
      console.log(`   - ${s.matricule || '(sans matricule)'} — ${s.prenom} ${s.nom} (PIN: ${s.pin_code.substring(0, 3)}***)`);
    });
    if (toHash.length > 10) console.log(`   ... et ${toHash.length - 10} autres.`);
    console.log('\n💡 Relance avec --apply pour appliquer réellement.');
    process.exit(0);
  }

  // 2. Hasher et mettre à jour un par un (avec suivi d'erreurs)
  let success = 0;
  let failed = 0;
  const failures = [];

  for (const [i, s] of toHash.entries()) {
    try {
      const pin_hash = await bcrypt.hash(s.pin_code, BCRYPT_ROUNDS);
      const { error: updateError } = await supabase
        .from('students')
        .update({ pin_code: pin_hash })
        .eq('id', s.id);

      if (updateError) throw updateError;
      success++;
      process.stdout.write(`\r   Progression : ${success + failed}/${toHash.length} (échecs: ${failed})`);
    } catch (err) {
      failed++;
      failures.push({ student: `${s.prenom} ${s.nom} (${s.matricule || s.id})`, reason: err.message });
    }
    await sleep(PAUSE_MS);
  }

  // 3. Résumé
  console.log('\n\n==========================================================');
  console.log('  RÉSUMÉ');
  console.log('==========================================================');
  console.log(`   ✅ Hashés avec succès : ${success}`);
  console.log(`   ❌ Échecs             : ${failed}`);

  if (failures.length > 0) {
    console.log('\n   Détail des échecs (relancer le script pour réessayer) :');
    failures.forEach(f => console.log(`   - ${f.student} → ${f.reason}`));
  }

  console.log('\n📌 Rappel : les mots de passe Supabase Auth n\'ont PAS été modifiés.');
  console.log('           Aucun parent n\'est impacté sur sa connexion.\n');

  process.exit(failed > 0 ? 2 : 0);
})();
