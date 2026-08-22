import type { PublicContentCore } from "./types";

export const englishPublicContent = {
  locale: "en",
  navigation: {
    primary: [
      { label: "Services", href: "/services" },
      { label: "How it works", href: "/how-it-works" },
      { label: "Why professional care", href: "/why-professional-cleaning" },
      { label: "Service area", href: "/service-area" },
      { label: "About", href: "/about" },
      { label: "FAQ", href: "/faq" },
      { label: "Contact", href: "/contact" },
    ],
    serviceLinks: [
      { label: "Carpet cleaning", href: "/services/carpet-cleaning" },
      { label: "Rug cleaning", href: "/services/rug-cleaning" },
      {
        label: "Sofa & upholstery",
        href: "/services/sofa-upholstery-cleaning",
      },
      { label: "Mattress cleaning", href: "/services/mattress-cleaning" },
      {
        label: "Office carpets",
        href: "/services/office-carpet-cleaning",
      },
      {
        label: "Delicate fabric care",
        href: "/services/delicate-fabric-care",
      },
    ],
  },
  metadata: {
    home: {
      title: "Professional on-site fabric care in Sofia",
      description:
        "Careful carpet, rug, upholstery and mattress cleaning for homes and businesses across Sofia.",
    },
    services: {
      title: "Carpet and upholstery cleaning services",
      description:
        "Explore professional on-site fabric care for carpets, rugs, sofas, mattresses and business premises in Sofia.",
    },
    howItWorks: {
      title: "How professional fabric cleaning works",
      description:
        "From initial description and material assessment to careful treatment, practical aftercare and return-to-use guidance.",
    },
    whyProfessional: {
      title: "Why choose professional fabric cleaning",
      description:
        "Understand the role of assessment, controlled treatment and material-aware decisions in professional fabric care.",
    },
    serviceArea: {
      title: "Cleaning service area across Sofia",
      description:
        "On-site carpet and upholstery care across Sofia city, with surrounding areas considered subject to availability.",
    },
    about: {
      title: "A considered approach to fabric care",
      description:
        "A calm, technically informed cleaning service designed around the material, the space and the people using it.",
    },
    faq: {
      title: "Professional cleaning questions",
      description:
        "Clear answers about on-site cleaning, furniture access, stains, drying, delicate fabrics and Sofia appointments.",
    },
    contact: {
      title: "Contact for fabric care in Sofia",
      description:
        "Contact details, intended appointment hours and the service-request route for Sofia homes and businesses.",
    },
    request: {
      title: "Describe your cleaning request",
      description:
        "Use the Phase 1 prototype to describe carpet, rug, upholstery or mattress cleaning needs without creating a booking.",
    },
  },
  services: [
    {
      catalogueCode: "CARPET_CARE",
      slug: "carpet-cleaning",
      title: "On-site carpet cleaning",
      shortTitle: "Carpet cleaning",
      eyebrow: "For fitted and room-size surfaces",
      description:
        "Professional carpet care planned around the fibre, construction, soil level and way the room needs to be used.",
      summary:
        "A practical on-site process for residential and commercial carpets, with treatment intensity confirmed after inspection.",
      idealFor: [
        "Apartments and houses",
        "Rented homes and managed properties",
        "Offices, hotels and serviced apartments",
        "High-use waiting and reception areas",
      ],
      process: [
        "Discuss the surface, access and visible condition.",
        "Inspect fibres, wear, colour response and specific marks.",
        "Confirm an appropriate treatment level and working sequence.",
        "Clean methodically, manage moisture and explain practical aftercare.",
      ],
      carePoints: [
        "Fibre-sensitive chemistry and agitation",
        "Attention to traffic lanes and edges",
        "Moisture managed for the material and conditions",
      ],
      expectations: [
        "Under suitable conditions, professional treatment may reach approximately 25 m² per hour, depending on the material, soiling, selected treatment and access to the surface.",
        "Many carpets can be treated where they are installed, reducing unnecessary transport and disruption.",
      ],
      limitations: [
        "Access around furniture may be needed; furniture movement is agreed for the specific job.",
        "Drying and return-to-use time vary with material, method, airflow, temperature, humidity and depth of treatment.",
        "Some permanent colour change, wear or staining may remain after a safe treatment.",
      ],
      related: ["rug-cleaning", "office-carpet-cleaning"],
    },
    {
      catalogueCode: "RUG_RUNNER_CARE",
      slug: "rug-cleaning",
      title: "Rug cleaning where appropriate",
      shortTitle: "Rug cleaning",
      eyebrow: "On-site convenience, material-led decisions",
      description:
        "Rugs are assessed individually so construction, dyes, backing, fringe and existing wear guide the safest sensible method.",
      summary:
        "Many rugs can be cleaned on site without routine collection, while delicate or uncertain pieces may need a specialist decision first.",
      idealFor: [
        "Everyday synthetic and wool rugs",
        "Large rugs that are disruptive to transport",
        "Rugs in occupied homes, offices and guest accommodation",
        "Items needing maintenance rather than restoration",
      ],
      process: [
        "Review material information, construction and any known history.",
        "Inspect colour stability, edges, fringe, backing and existing damage.",
        "Choose a proportionate method or recommend a specialist route.",
        "Treat accessible areas and provide positioning and drying guidance.",
      ],
      carePoints: [
        "Colourfastness and dye-migration awareness",
        "Backing, edge and fringe sensitivity",
        "Minimum unnecessary mechanical or chemical stress",
      ],
      expectations: [
        "The aim is the best reasonable cleaning result with minimum unnecessary stress on the rug.",
        "Keeping suitable rugs on site can reduce handling and transport disruption.",
      ],
      limitations: [
        "Not every rug is a safe candidate for an on-site method.",
        "Handmade, antique, unstable, high-value or unidentified rugs require specialist assessment before treatment.",
        "Complete stain removal cannot be promised without risking the material.",
      ],
      related: ["carpet-cleaning", "delicate-fabric-care"],
    },
    {
      catalogueCode: "UPHOLSTERY_CARE",
      slug: "sofa-upholstery-cleaning",
      title: "Sofa and upholstery cleaning",
      shortTitle: "Sofa & upholstery",
      eyebrow: "Care for the furniture already in use",
      description:
        "On-site care for sofas, armchairs, dining chairs and other suitable upholstery, planned around fabric, construction and everyday use.",
      summary:
        "A controlled process for accumulated soil, contact areas and visible marks without treating every fabric as if it were the same.",
      idealFor: [
        "Sofas, sectionals and armchairs",
        "Dining and occasional chairs",
        "Hotel, office and reception upholstery",
        "Rented and serviced accommodation",
      ],
      process: [
        "Identify fabric information and discuss previous cleaning or damage.",
        "Inspect seams, cushions, colour response and high-contact areas.",
        "Confirm method, treatment intensity and realistic stain expectations.",
        "Clean in a controlled sequence and explain ventilation and reuse.",
      ],
      carePoints: [
        "Fabric and colour-response checks",
        "Controlled brushing and moisture",
        "Attention to seams, piping and existing wear",
      ],
      expectations: [
        "Most suitable upholstery is treated where the furniture already lives, avoiding unnecessary transport.",
        "Portable equipment is selected with residential use and low disruption in mind, without making an acoustic guarantee.",
      ],
      limitations: [
        "Loose cushions and access around the item may be needed.",
        "Some fabrics, fillings, trims or unstable colours require a gentler plan or specialist referral.",
        "Return-to-use time depends on fabric, filling, treatment depth and room conditions.",
      ],
      related: ["delicate-fabric-care", "mattress-cleaning"],
    },
    {
      catalogueCode: "MATTRESS_CARE",
      slug: "mattress-cleaning",
      title: "Professional mattress cleaning",
      shortTitle: "Mattress cleaning",
      eyebrow: "Regular care without fear-based claims",
      description:
        "A measured maintenance service focused on accumulated soil, dust, residues and body oils in suitable mattress surfaces.",
      summary:
        "Professional cleaning can refresh the surface while material, construction and drying conditions remain central to the plan.",
      idealFor: [
        "Routine household mattress maintenance",
        "Rented and serviced accommodation",
        "Guest houses and hotels",
        "Mattresses with suitable, accessible textile surfaces",
      ],
      process: [
        "Discuss the mattress construction, care label and areas of concern.",
        "Inspect the surface, seams, existing marks and moisture sensitivity.",
        "Confirm a proportionate cleaning method and realistic outcome.",
        "Treat accessible surfaces and give clear ventilation and reuse advice.",
      ],
      carePoints: [
        "Low-residue, material-aware decisions",
        "Controlled moisture and treatment depth",
        "Practical attention to ventilation before reuse",
      ],
      expectations: [
        "Deep professional cleaning can help remove accumulated soil, dust and residues that routine vacuuming may leave behind.",
        "The goal is responsible maintenance and a refreshed surface, not a medical outcome.",
      ],
      limitations: [
        "Cleaning does not replace manufacturer care guidance or resolve structural mattress problems.",
        "Drying time varies with construction, method, airflow, temperature and humidity.",
        "No clinical decontamination, health outcome or complete stain-removal promise is made.",
      ],
      related: ["sofa-upholstery-cleaning", "delicate-fabric-care"],
    },
    {
      catalogueCode: "COMMERCIAL_TEXTILE_CARE",
      slug: "office-carpet-cleaning",
      title: "Office and commercial carpet cleaning",
      shortTitle: "Office carpets",
      eyebrow: "Planned around operating hours",
      description:
        "Structured carpet care for offices, hotels, managed properties and suitable public-facing spaces with disruption kept practical.",
      summary:
        "Area, access, traffic patterns and return-to-use priorities are reviewed before agreeing the treatment and working sequence.",
      idealFor: [
        "Offices and coworking spaces",
        "Hotels, guest houses and serviced apartments",
        "Waiting areas and property common spaces",
        "Suitable restaurant, café and educational areas",
      ],
      process: [
        "Map the surface, access windows, traffic lanes and operational constraints.",
        "Assess fibre, wear, soil and areas requiring focused treatment.",
        "Plan sections, treatment intensity and practical return-to-use sequence.",
        "Complete the agreed areas and hand over clear aftercare guidance.",
      ],
      carePoints: [
        "Phased work for occupied premises",
        "Traffic-lane and spot assessment",
        "Clear expectations for access and reuse",
      ],
      expectations: [
        "Under suitable conditions, professional treatment may reach approximately 25 m² per hour, depending on the material, soiling, selected treatment and access to the surface.",
        "Early or later appointments may reduce operational disruption when building and local requirements allow.",
      ],
      limitations: [
        "An area estimate is not a fixed completion-time promise.",
        "Access, furniture, security procedures and building rules affect the working plan.",
        "Clinical or medical decontamination is outside this general fabric-care service.",
      ],
      related: ["carpet-cleaning", "sofa-upholstery-cleaning"],
    },
    {
      catalogueCode: "DELICATE_TEXTILE_ASSESSMENT",
      slug: "delicate-fabric-care",
      title: "Delicate and valuable fabric assessment",
      shortTitle: "Delicate fabric care",
      eyebrow: "Assessment before intensity",
      description:
        "A cautious route for uncertain, delicate, aged or valuable materials where preservation matters more than an aggressive visual result.",
      summary:
        "Material identification, colour response, existing wear and construction guide whether to proceed, modify the method or recommend specialist care.",
      idealFor: [
        "Sensitive natural fibres and blends",
        "Older upholstery and rugs",
        "Items with unstable colour or prior damage",
        "Valuable pieces where the treatment decision needs extra care",
      ],
      process: [
        "Gather care labels, provenance and previous treatment information where available.",
        "Inspect fibre sensitivity, colourfastness, wear, seams and construction.",
        "Discuss risk, test cautiously where appropriate and define a safe scope.",
        "Proceed only when the proposed treatment is proportionate to the material.",
      ],
      carePoints: [
        "Colourfastness and fibre sensitivity",
        "Reduced agitation and carefully selected chemistry",
        "Existing wear, age and construction constraints",
      ],
      expectations: [
        "The aim is the best reasonable cleaning result with minimum unnecessary stress on the material.",
        "A responsible result may mean supporting useful life rather than pursuing every remaining mark.",
      ],
      limitations: [
        "Assessment may conclude that on-site cleaning is not appropriate.",
        "Testing reduces uncertainty but cannot remove every material risk.",
        "No promise is made that every stain can be safely removed.",
      ],
      related: ["rug-cleaning", "sofa-upholstery-cleaning"],
    },
  ],
  treatmentLevels: [
    {
      catalogueCode: "GENTLE_CARE",
      number: "01",
      name: "Gentle Care",
      description:
        "A restrained approach where fibre sensitivity, light maintenance needs or preservation priorities call for minimal intensity.",
      intendedFor: "Sensitive materials and lighter maintenance",
    },
    {
      catalogueCode: "REFRESH",
      number: "02",
      name: "Refresh",
      description:
        "Routine professional care for suitable fabrics with general soil and no indication that a more intensive plan is needed.",
      intendedFor: "Regular maintenance and general freshening",
    },
    {
      catalogueCode: "DEEP_CLEAN",
      number: "03",
      name: "Deep Clean",
      description:
        "A more thorough treatment for established soil, traffic lanes and residues, balanced against the material and construction.",
      intendedFor: "Established use and more visible soiling",
    },
    {
      catalogueCode: "INTENSIVE",
      number: "04",
      name: "Intensive",
      description:
        "Focused work for heavier conditions or multiple areas of concern where the material can safely accept greater treatment intensity.",
      intendedFor: "Heavier soil and complex, suitable surfaces",
    },
    {
      catalogueCode: "SPECIALIST_ASSESSMENT",
      number: "05",
      name: "Specialist Assessment",
      description:
        "A decision-first route when value, age, material uncertainty, unstable colour, prior damage or unusual contamination changes the risk.",
      intendedFor: "Delicate, valuable or uncertain items",
    },
  ],
  faqs: [
    {
      question: "Do you take carpets and rugs away?",
      answer:
        "Many suitable carpets and rugs can be cleaned where they are, reducing transport and disruption. Construction, colour stability, condition and access are assessed first; some delicate or unusual rugs may need a different specialist route.",
    },
    {
      question: "Do I need to move furniture?",
      answer:
        "Clear access helps. Light items may need to be removed and larger furniture is discussed for the specific job. We do not promise that every item can remain untouched or that all furniture will be moved.",
    },
    {
      question: "How long does cleaning take?",
      answer:
        "Time depends on area, material, access, condition and treatment level. Under suitable conditions, professional treatment may reach approximately 25 m² per hour, depending on the material, soiling, selected treatment and access to the surface. This is not a guaranteed completion time.",
    },
    {
      question: "How quickly can the surface be used again?",
      answer:
        "The method is directed toward limiting residual moisture and returning treated surfaces to normal use sooner. Actual timing depends on the material, treatment depth, airflow, temperature, relative humidity, contamination and surface construction, so guidance is specific to the item and conditions.",
    },
    {
      question: "Can every stain be removed?",
      answer:
        "No responsible cleaner can promise that. A stain may have permanently changed the fibre or colour, and aggressive treatment can create unnecessary damage. The aim is the best reasonable result without placing the material under avoidable stress.",
    },
    {
      question: "How is the treatment level selected?",
      answer:
        "You describe the item and condition; the appropriate level is confirmed after professional inspection. Material, construction, soil, stains, wear, prior treatments and practical access all inform the decision.",
    },
    {
      question: "Can delicate fabrics be cleaned?",
      answer:
        "Some can, but they need a cautious assessment of fibres, dyes, trims, wear and construction. The safest decision may be a gentler method, a limited scope or referral rather than a more intensive clean.",
    },
    {
      question: "Do you clean mattresses?",
      answer:
        "Yes, suitable mattress surfaces can receive professional maintenance focused on accumulated soil, dust, residues and body oils. The service makes no medical or clinical-decontamination promise, and ventilation guidance depends on the specific mattress and conditions.",
    },
    {
      question: "Do you work in offices and hotels?",
      answer:
        "The service is intended for offices, hotels, guest houses, serviced apartments, managed properties and other suitable business environments. Access windows, occupied areas and practical return-to-use needs are discussed before work is agreed.",
    },
    {
      question: "Which parts of Sofia do you cover?",
      answer:
        "The initial service area is Sofia city. Surrounding areas may be considered subject to availability; district zones and any travel pricing will be defined in a later pricing phase.",
    },
    {
      question: "Can I request an early-morning or evening appointment?",
      answer:
        "Appointments are intended to be available approximately from 06:00 to 22:00, subject to building rules, local requirements, the type of job and availability. A requested period is not a confirmed appointment.",
    },
    {
      question: "Is the service suitable for allergy-conscious households?",
      answer:
        "Deep professional cleaning can help remove accumulated soil, dust and residues that routine vacuuming may leave behind. It is a fabric-maintenance service, not medical treatment, and no personal health outcome is promised.",
    },
  ],
} as const satisfies PublicContentCore;
