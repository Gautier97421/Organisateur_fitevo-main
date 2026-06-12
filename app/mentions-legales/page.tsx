import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Scale } from "lucide-react"

export const metadata = {
  title: "Mentions légales — FitEvo",
}

export default function MentionsLegalesPage() {
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
            <Scale className="w-7 h-7 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Mentions légales</h1>
            <p className="text-sm text-gray-500">Dernière mise à jour : juin 2026</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-7 text-sm leading-relaxed text-gray-700">
          <Section title="Éditeur">
            <table className="w-full text-sm border-collapse">
              <tbody>
                <RowLink label="Site" href="https://solodesign.fr/" />
                <Row label="Forme juridique" value="SAS (Société par Actions Simplifiée)" />
                <Row label="Capital social" value="1 000 €" />
                <Row label="SIRET" value="10479308800014" />
                <Row label="SIREN" value="104793088" />
                <Row label="RCS" value="RCS Paris 104 793 088" />
                <Row label="Siège social" value="47 RUE VIVIENNE, 75002 PARIS" />
                <Row label="N° TVA intracommunautaire" value="FR45104793088" />
                <Row label="Directeur de la publication" value="Gautier Hoarau" />
                <Row label="Contact" value="gautier@solodesign.fr" />
              </tbody>
            </table>
          </Section>

          <Section title="Hébergement">
            L'application est hébergée par&nbsp;:
            <address className="not-italic mt-2 ml-3 text-gray-700 space-y-0.5">
              <p><strong>OVH SAS</strong></p>
              <p>2 rue Kellermann, 59100 Roubaix, France</p>
              <p>
                Site web&nbsp;:{" "}
                <a href="https://www.ovhcloud.com" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:text-red-700 underline">
                  www.ovhcloud.com
                </a>
              </p>
            </address>
          </Section>

          <Section title="Propriété intellectuelle">
            L'ensemble des éléments composant l'application (logo, interface, code) est protégé par
            le droit de la propriété intellectuelle. Toute reproduction non autorisée est interdite.
          </Section>

          <Section title="Données personnelles">
            Le traitement des données personnelles est décrit dans notre{" "}
            <Link href="/confidentialite" className="text-red-600 hover:text-red-700 underline">
              politique de confidentialité
            </Link>
            . Conformément au RGPD, vous disposez de droits sur vos données, exerçables auprès de
            votre administrateur.
          </Section>

          <Section title="Cookies">
            L'application utilise uniquement un cookie de session technique strictement nécessaire à
            l'authentification. Aucun cookie de mesure d'audience ou publicitaire n'est utilisé.
          </Section>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          <Link href="/confidentialite" className="hover:text-gray-600 underline">Politique de confidentialité</Link>
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

function RowLink({ label, href }: { label: string; href: string }) {
  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2 pr-4 font-medium text-gray-500 whitespace-nowrap w-56 align-top">{label}</td>
      <td className="py-2 align-top">
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:text-red-700 underline">
          {href}
        </a>
      </td>
    </tr>
  )
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2 pr-4 font-medium text-gray-500 whitespace-nowrap w-56 align-top">{label}</td>
      <td className="py-2 text-gray-900 align-top">
        {value}
        {note && <span className="ml-2 text-xs text-gray-400">({note})</span>}
      </td>
    </tr>
  )
}
