import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Star, ChevronRight } from "lucide-react";
import heroBg from "@assets/MS_Homepage_Photo_1920x1080_1775403929888.jpg";

const TEAM = [
  { name: "Sarah Johnson", position: "Founder & CEO", initials: "SJ" },
  { name: "David Kim", position: "Operations Manager", initials: "DK" },
  { name: "Mia Chen", position: "Student Relations", initials: "MC" },
];

const TESTIMONIALS = [
  {
    name: "Hyunjin Park",
    flag: "🇰🇷",
    text: "MillionStay made my move to Melbourne so smooth. The team helped me find the perfect room near my university, and the whole process was incredibly easy. I felt supported from day one.",
    rating: 5,
  },
  {
    name: "Yuki Tanaka",
    flag: "🇯🇵",
    text: "As an international student I was nervous about finding accommodation, but MillionStay was amazing. The staff speak my language and the rooms are exactly as described. Highly recommended!",
    rating: 5,
  },
  {
    name: "Arisa Sombat",
    flag: "🇹🇭",
    text: "Great service and beautiful rooms. The flexible monthly plans meant I wasn't locked into a long lease, which was perfect for my student visa situation. Will definitely use again.",
    rating: 4,
  },
];

const BLOGS = [
  {
    tag: "Guide",
    title: "Top 5 Suburbs for International Students in Melbourne",
    excerpt: "Discover the best neighbourhoods close to universities, transport, and dining.",
    date: "Mar 2025",
    imgUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80",
  },
  {
    tag: "Tips",
    title: "How to Set Up Your Life in Melbourne: A Complete Checklist",
    excerpt: "From SIM cards to bank accounts — everything you need when you first arrive.",
    date: "Feb 2025",
    imgUrl: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=600&q=80",
  },
  {
    tag: "Student Life",
    title: "Melbourne on a Budget: Free & Cheap Things to Do",
    excerpt: "Explore markets, parks, galleries and events without spending a fortune.",
    date: "Jan 2025",
    imgUrl: "https://images.unsplash.com/photo-1514395462151-6b5e5abad7bc?w=600&q=80",
  },
];

function fade(delay = 0) {
  return { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay } };
}

export default function About() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* Banner */}
      <div className="relative h-52 md:h-64 overflow-hidden">
        <img src={heroBg} alt="About Us" className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/50" />
        <div className="absolute inset-0 flex flex-col items-start justify-end px-8 pb-8 max-w-7xl mx-auto w-full">
          <p className="font-cursive text-white/70 text-sm italic mb-1">Who we are</p>
          <h1 className="text-3xl md:text-4xl font-bold text-white italic">About Us</h1>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto w-full px-6 py-3 flex items-center gap-1.5 text-xs text-gray-400">
        <Link href="/" className="hover:text-primary">Home</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-600">About Us</span>
      </div>

      {/* Introduction */}
      <section className="max-w-7xl mx-auto w-full px-6 py-12">
        <div className="flex flex-col md:flex-row gap-10 items-center">
          <motion.div {...fade()} className="flex-1">
            <p className="font-cursive text-primary text-lg italic mb-1">Introduction</p>
            <h2 className="text-3xl font-bold text-gray-900 mb-5">GET TO KNOW US</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              MillionStay was founded with a simple mission: to make accommodation in Melbourne genuinely accessible and welcoming for international students and digital nomads. We know that finding a safe, comfortable, and affordable home in a new country is one of the biggest challenges you'll face — and we're here to make it easier.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              Our multilingual team (English, Korean, Chinese, Japanese and Thai) works every day to match students with the right rooms, handle paperwork, and ensure every guest feels at home from the moment they arrive.
            </p>
            <p className="text-gray-600 leading-relaxed">
              We offer flexible stay plans from 1 to 6 months, quality-verified rooms across Melbourne's best student suburbs, and personal support throughout your entire stay. No hidden fees, no stress — just a great place to call home.
            </p>
          </motion.div>
          <motion.div {...fade(0.1)} className="flex-1 flex justify-center">
            <div className="rounded-2xl overflow-hidden shadow-lg w-full max-w-md aspect-[4/3]">
              <img
                src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80"
                alt="Our team"
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Our Team */}
      <section className="bg-orange-50 py-14 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <p className="font-cursive text-primary text-xl italic mb-1">Our Team</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {TEAM.map((member, i) => (
              <motion.div key={member.name} {...fade(i * 0.08)}
                className="bg-white rounded-2xl p-6 flex flex-col items-center text-center shadow-sm border">
                <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center mb-4 border-4 border-orange-100">
                  <span className="text-2xl font-bold text-gray-500">{member.initials}</span>
                </div>
                <p className="font-semibold text-gray-800">{member.name}</p>
                <p className="text-sm text-primary mt-0.5">{member.position}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-14 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <p className="font-cursive text-primary text-xl italic">Testimonials</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <motion.div key={t.name} {...fade(i * 0.08)}
                className="bg-orange-50 rounded-2xl p-6 border border-orange-100 flex flex-col">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className={`h-4 w-4 ${j < t.rating ? "fill-primary text-primary" : "text-gray-300"}`} />
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed flex-1 mb-5 italic">"{t.text}"</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{t.flag}</span>
                  <p className="font-semibold text-gray-800 text-sm">{t.name}</p>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="flex justify-center mt-8">
            <Link href="/search">
              <button className="bg-primary text-white px-8 py-2.5 rounded-full text-sm font-semibold hover:bg-primary/90 transition-colors">
                View More
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Our Blog */}
      <section className="bg-gray-50 py-14 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-3">
            <p className="font-cursive text-primary text-xl italic">Our Blog</p>
          </div>
          <p className="text-center text-gray-500 text-sm mb-10 max-w-xl mx-auto">
            Tips, guides, and stories to help international students thrive in Melbourne.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {BLOGS.map((post, i) => (
              <motion.div key={post.title} {...fade(i * 0.08)}
                className="bg-white rounded-2xl overflow-hidden border shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <div className="relative h-44 overflow-hidden">
                  <img src={post.imgUrl} alt={post.title} className="w-full h-full object-cover" />
                  <span className="absolute top-3 left-3 bg-primary text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                    {post.tag}
                  </span>
                </div>
                <div className="p-5">
                  <p className="text-xs text-gray-400 mb-2">{post.date}</p>
                  <h3 className="font-semibold text-gray-800 text-sm mb-2 leading-snug">{post.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{post.excerpt}</p>
                  <button className="mt-4 text-primary text-xs font-semibold hover:underline">Read More →</button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
