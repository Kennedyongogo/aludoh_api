// Seeds 10 demo service requests from around Kenya, covering every service and every status.
// Requests past "pending" are assigned to the given admin (defaults to Vincent Aludoh).
// Re-running replaces the previous demo rows (matched by their phone numbers) instead of duplicating them.
// Usage: npm run seed:service-requests -- [admin-email]
const crypto = require("crypto");
const { ServiceRequest, User, sequelize } = require("../src/models");

const adminEmail = (process.argv[2] || "vincentaludoh@gmail.com").trim().toLowerCase();

// Same format as the controller: MC-YY-XXXXXX, without 0/O or 1/I
const REFERENCE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const generateReference = () => {
  const code = Array.from(
    crypto.randomBytes(6),
    (byte) => REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length]
  ).join("");
  return `MC-${String(new Date().getFullYear()).slice(-2)}-${code}`;
};

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days) => new Date(Date.now() - days * DAY);

const DEMO_REQUESTS = [
  {
    service: "Hydroponic Farming",
    name: "Grace Wanjiku",
    phone: "+254712400101",
    email: "grace.wanjiku@example.com",
    location: "Ruiru, Kiambu County",
    farm_size: "Rooftop, about 120 m²",
    crop: "Lettuce, spinach, basil",
    farming_method: "None yet (new setup)",
    service_required: "Design and installation of an NFT hydroponic system",
    message: "I want to grow leafy greens on my apartment rooftop to supply restaurants in Thika Road. Please advise on the system size and cost.",
    status: "pending",
    priority: "normal",
    submitted: 1,
  },
  {
    service: "Vertical Farming",
    name: "Brian Otieno",
    phone: "+254722400102",
    email: "brian.otieno@example.com",
    location: "Milimani, Kisumu County",
    organization: "Lakeside Fresh Greens",
    farm_size: "Warehouse, 300 m²",
    crop: "Kale (sukuma wiki), strawberries",
    farming_method: "Open field",
    service_required: "Feasibility study for indoor vertical racks",
    message: "We are converting an unused warehouse near Kisumu town into a vertical farm and need a feasibility study before we invest.",
    status: "reviewing",
    priority: "high",
    admin_response: "Thanks Brian. Our team is reviewing the warehouse photos and floor plan you shared. We'll call you within 3 working days with next steps.",
    admin_notes: "Check power supply capacity at the warehouse before quoting.",
    submitted: 3,
  },
  {
    service: "Organic Agriculture",
    name: "Fatuma Hassan",
    phone: "+254733400103",
    email: null,
    location: "Nyali, Mombasa County",
    farm_size: "2 acres",
    crop: "Mangoes, cowpeas, tomatoes",
    farming_method: "Conventional (chemical fertilisers)",
    service_required: "Transition plan to certified organic production",
    message: "I would like to move my farm to organic and eventually get certified so I can sell to hotels along the coast.",
    status: "in_progress",
    priority: "normal",
    admin_response: "Your organic transition plan is being prepared. We have started with a soil health assessment and will share the full plan by the end of next week.",
    admin_notes: "Soil samples sent to the lab on day 2.",
    submitted: 9,
  },
  {
    service: "Agronomy Consultancy",
    name: "Peter Kiprono",
    phone: "+254711400104",
    email: "p.kiprono@example.com",
    location: "Moiben, Uasin Gishu County",
    farm_size: "15 acres",
    crop: "Maize",
    farming_method: "Mechanised open field",
    service_required: "Diagnosis of yellowing and stunted maize",
    message: "Large patches of my maize are yellowing and drying from the edges. I suspect maize lethal necrosis. Please send someone urgently.",
    status: "scheduled",
    priority: "urgent",
    admin_response: "An agronomist will visit your farm in Moiben on Thursday at 9:00 AM. Please avoid spraying the affected area before the visit.",
    admin_notes: "Possible MLN. Bring sample bags and test kits.",
    submitted: 5,
  },
  {
    service: "Landscaping",
    name: "Mary Akinyi",
    phone: "+254701400105",
    email: "mary.akinyi@example.com",
    location: "Karen, Nairobi County",
    organization: "Karen Hills Residents Association",
    farm_size: "Common area, about half an acre",
    service_required: "Redesign of the estate entrance and common garden",
    message: "Our association wants a low-maintenance, water-wise garden at the estate entrance.",
    status: "resolved",
    priority: "low",
    admin_response: "The landscaping work is complete. Thank you for choosing Mcaludoh Consultancy. Maintenance tips have been emailed to you.",
    admin_notes: "Job closed after the final walkthrough with the committee.",
    submitted: 32,
    resolvedAfter: 21,
  },
  {
    service: "Training & Capacity Building",
    name: "Joseph Mwangi",
    phone: "+254745400106",
    email: "othaya.coop@example.com",
    location: "Othaya, Nyeri County",
    organization: "Othaya Dairy & Horticulture Farmers Co-operative",
    service_required: "Two-day training on greenhouse management for 40 members",
    message: "We need practical training for our members on greenhouse tomato production and pest control.",
    status: "reviewing",
    priority: "normal",
    admin_response: "Thank you, Joseph. We are putting together a training outline and quote for 40 participants and will send it shortly.",
    submitted: 4,
  },
  {
    service: "EIA Services",
    name: "Abdi Mohamed",
    phone: "+254724400107",
    email: "abdi.mohamed@example.com",
    location: "Garissa Township, Garissa County",
    organization: "Tana Riverbank Irrigation Group",
    farm_size: "50 acres",
    crop: "Watermelon, sorghum",
    farming_method: "Irrigation from the Tana River",
    service_required: "Environmental Impact Assessment for a new irrigation scheme",
    message: "NEMA requires an EIA report before we can expand our irrigation scheme. Please help us with the full process.",
    status: "in_progress",
    priority: "high",
    admin_response: "Field data collection for your EIA is under way. The draft report will be ready for your review in about two weeks.",
    admin_notes: "Public participation meeting planned with the local community.",
    submitted: 14,
  },
  {
    service: "Other",
    name: "Esther Chebet",
    phone: "+254757400108",
    email: null,
    location: "Litein, Kericho County",
    farm_size: "1.5 acres",
    crop: "Tea",
    service_required: "Soil testing for a tea smallholding",
    message: "I only need a soil test to know which fertiliser to use on my tea bushes.",
    status: "cancelled",
    priority: "low",
    admin_response: "This request was cancelled at your request. You are welcome to contact us again any time.",
    admin_notes: "Client got soil testing done through KTDA instead.",
    submitted: 20,
  },
  {
    service: "Hydroponic Farming",
    name: "Daniel Mutua",
    phone: "+254768400109",
    email: "daniel.mutua@example.com",
    location: "Kangundo, Machakos County",
    farm_size: "Backyard shed",
    crop: "Hydroponic fodder (barley) for dairy goats",
    farming_method: "Zero grazing",
    service_required: "Hydroponic fodder system setup",
    message: "Pasture is scarce during the dry season. I want to grow hydroponic fodder for my 12 dairy goats.",
    status: "resolved",
    priority: "normal",
    admin_response: "Your hydroponic fodder unit is installed and producing. Thank you for working with us.",
    submitted: 45,
    resolvedAfter: 30,
  },
  {
    service: "Organic Agriculture",
    name: "Winnie Nekesa",
    phone: "+254790400110",
    email: "winnie.nekesa@example.com",
    location: "Kanduyi, Bungoma County",
    organization: "Bungoma Youth in Agribusiness",
    farm_size: "3 acres",
    crop: "Beans, African leafy vegetables",
    farming_method: "Mixed farming",
    service_required: "Organic compost and bio-pesticide advice",
    message: "Our youth group wants to produce organic vegetables for the Bungoma market. We need guidance on compost making and natural pest control.",
    status: "pending",
    priority: "normal",
    submitted: 0.2,
  },
];

(async () => {
  try {
    await sequelize.authenticate();
    await ServiceRequest.sync({ force: false, alter: false });

    const admin = await User.findOne({ where: { email: adminEmail }, attributes: ["id", "name"] });
    if (!admin) {
      console.error(`No admin user found with email ${adminEmail}.`);
      process.exitCode = 1;
      return;
    }

    const removed = await ServiceRequest.destroy({
      where: { phone: DEMO_REQUESTS.map((r) => r.phone) },
    });
    if (removed) console.log(`Removed ${removed} previous demo request(s).`);

    const created = [];
    for (const { submitted, resolvedAfter, ...fields } of DEMO_REQUESTS) {
      const submittedAt = daysAgo(submitted);
      const handled = fields.status !== "pending";
      const respondedAt = fields.admin_response ? new Date(submittedAt.getTime() + 0.5 * DAY) : null;
      const resolvedAt = fields.status === "resolved" ? new Date(submittedAt.getTime() + resolvedAfter * DAY) : null;

      const request = await ServiceRequest.create({
        ...fields,
        reference: generateReference(),
        handled_by: handled ? admin.id : null,
        responded_at: respondedAt,
        resolved_at: resolvedAt,
      });

      // Sequelize always stamps createdAt/updatedAt with "now" on create, so backdate them directly
      const updatedAt = resolvedAt || respondedAt || submittedAt;
      await sequelize.query(
        'UPDATE service_requests SET "createdAt" = :createdAt, "updatedAt" = :updatedAt WHERE id = :id',
        { replacements: { createdAt: submittedAt, updatedAt, id: request.id } }
      );

      created.push(request);
    }

    console.log(`\nCreated ${created.length} demo service requests (handled by ${admin.name}):\n`);
    console.table(
      created.map((r) => ({
        reference: r.reference,
        service: r.service,
        status: r.status,
        priority: r.priority,
        name: r.name,
        location: r.location,
        phone: r.phone,
      }))
    );
  } catch (error) {
    console.error("Failed to seed service requests:", error.parent?.message || error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
