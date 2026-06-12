import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, ShieldCheck } from "lucide-react"

export const metadata = {
  title: "Politique de confidentialité — FitEvo",
}

export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 sticky top-0 z-10">
        <Link
          href="/admin"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>

        {/* Logo centré */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0">
            <Image src="/Logo-removebg-preview.png" alt="FitEvo" width={36} height={36} className="object-contain w-full h-full" />
          </div>
          <span className="font-extrabold text-gray-900 text-lg tracking-tight">FitEvo</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-7 h-7 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Politique de confidentialité</h1>
            <p className="text-sm text-gray-500">Dernière mise à jour : juin 2026</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-7 text-sm leading-relaxed text-gray-700">
          <Section title="1. Responsable du traitement">
            L'application FitEvo est un outil interne de gestion des salles de sport, destiné aux
            employés et administrateurs de l'organisation exploitante. Le responsable du traitement
            des données est l'exploitant de FitEvo. Pour toute question relative à vos données,
            contactez votre administrateur.
          </Section>

          <Section title="2. Données collectées">
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Identité&nbsp;:</strong> nom, adresse email, pseudonyme.</li>
              <li><strong>Compte&nbsp;:</strong> rôle, mot de passe (stocké de façon chiffrée — hachage bcrypt), photo de profil.</li>
              <li><strong>Activité professionnelle&nbsp;:</strong> plannings, périodes de travail, pointages, salle affectée.</li>
              <li><strong>Caisse&nbsp;:</strong> saisies de caisse associées à votre compte.</li>
              <li><strong>Messagerie interne&nbsp;:</strong> messages et pièces jointes échangés.</li>
            </ul>
          </Section>

          <Section title="3. Finalités du traitement">
            Les données sont traitées exclusivement pour le fonctionnement de l'outil interne&nbsp;:
            organisation du travail, suivi des présences, gestion de la caisse, communication entre
            collaborateurs et administration des accès. Elles ne sont jamais revendues ni utilisées
            à des fins commerciales.
          </Section>

          <Section title="4. Base légale">
            Le traitement repose sur l'intérêt légitime de l'employeur à organiser son activité et,
            le cas échéant, sur l'exécution du contrat de travail et le respect d'obligations légales
            (notamment en matière de paie et de durée du travail).
          </Section>

          <Section title="5. Durée de conservation">
            Les données de compte sont conservées tant que le compte est actif. Les périodes de
            travail temporaires et les tâches complétées sont automatiquement purgées. Les jetons de
            réinitialisation de mot de passe sont supprimés dès leur utilisation ou expiration. Les
            données liées à des obligations légales (paie) sont conservées pour la durée imposée par
            la loi, puis anonymisées.
          </Section>

          <Section title="6. Sécurité">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Mots de passe chiffrés (hachage bcrypt).</li>
              <li>Sessions sécurisées par cookie signé, HttpOnly, Secure et SameSite.</li>
              <li>Limitation des tentatives de connexion (anti-force brute).</li>
              <li>En-têtes de sécurité HTTP (CSP, HSTS, anti-clickjacking).</li>
              <li>Aucune donnée personnelle dans les journaux applicatifs.</li>
            </ul>
          </Section>

          <Section title="7. Vos droits">
            Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement,
            de limitation, d'opposition et de portabilité de vos données. Ces droits peuvent être
            exercés auprès de votre administrateur, qui dispose des outils nécessaires (export et
            anonymisation des données) depuis l'espace d'administration.
          </Section>

          <Section title="8. Contact">
            Pour exercer vos droits ou pour toute question relative à la protection de vos données,
            adressez-vous à l'administrateur de votre établissement.
          </Section>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          <Link href="/mentions-legales" className="hover:text-gray-600 underline">Mentions légales</Link>
        </p>
      </main>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold text-gray-900 mb-3">{title}</h2>
      <div className="text-gray-700">{children}</div>
    </section>
  )
}
