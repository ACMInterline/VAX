import type { PublicSiteCopy } from "./types";

export const englishPublicSiteCopy = {
  common: {
    brand: {
      descriptor: "On-site carpet and upholstery care",
      tagline: "Professional fabric care, where your furniture already lives.",
      location: "Sofia, Bulgaria",
      serviceArea: "Sofia city, with surrounding areas subject to availability",
      phonePlaceholder: "Phone to be confirmed",
      emailPlaceholder: "Email to be confirmed",
      appointmentShort: "Appointments intended from 06:00 to 22:00",
      appointmentDetail:
        "Early and evening appointments are offered according to the service, address, building rules and team availability.",
      primaryCta: "Describe what needs care",
    },
    accessibility: {
      skipToContent: "Skip to main content",
      primaryNavigation: "Primary navigation",
      mobileNavigation: "Mobile navigation",
      openNavigation: "Open navigation",
      closeNavigation: "Close navigation",
      breadcrumb: "Breadcrumb",
      languageSelector: "Choose language",
      servicePrinciples: "Service principles",
    },
    headerRequest: "Request care",
    languageNames: { bg: "Bulgarian", en: "English" },
    footer: {
      eyebrow: "Care, considered",
      services: "Services",
      explore: "Explore",
      contact: "Contact",
      assessmentNotice: "Service details and timing remain subject to assessment.",
      prototypeNotice: "Submitting a request creates no quote, booking or payment.",
    },
    defaultCta: {
      eyebrow: "Start with the surface",
      title: "Tell us what needs care.",
      description:
        "Share the material, condition, access and preferred timing. The team will review the request; no quote or booking is created automatically.",
    },
    serviceCard: { onSite: "On-site care", explore: "Explore service" },
    serviceDetail: {
      home: "Home",
      services: "Services",
      describeSurface: "Describe your surface",
      seeProcess: "See the process",
      serviceEyebrow: "The service",
      idealFor: "Well suited to",
      process: {
        eyebrow: "A controlled sequence",
        title: "Assessment directs the work.",
        description:
          "You provide useful context before the visit. The final method and intensity remain professional decisions made after seeing the item.",
      },
      futureImage: "Future image: actual technician, equipment and material detail, used with permission.",
      materialEyebrow: "Material before muscle",
      materialTitle: "Care decisions that respect the surface.",
      materialDescription:
        "Cleaning effectiveness matters, but so do fibre sensitivity, colour response, age, construction and existing wear.",
      expectationsEyebrow: "What to expect",
      expectationsTitle: "Clear, practical guidance.",
      limitationsEyebrow: "Important limits",
      limitationsTitle: "No one-size-fits-all promises.",
      related: { eyebrow: "Related care", title: "Other surfaces in the same space." },
      visualLabel: "Abstract fabric-care visual",
    },
    treatmentNote:
      "You describe the condition. The appropriate treatment is confirmed after professional inspection.",
    visuals: {
      abstractFabric: "Abstract woven-fabric study reserved for future original photography",
      surface: "Surface",
      assessedFirst: "Assessed first",
      onSite: "On site",
      originalPhotography: "Original photography planned",
    },
  },
  pages: {
    home: {
      hero: {
        kicker: "Professional fabric care · Sofia",
        eyebrow: "Professional care on site",
        title: "Professional fabric care, where your furniture already lives.",
        description:
          "On-site carpet, rug, upholstery and mattress cleaning for homes, offices and hospitality spaces — planned for less disruption, careful material decisions and a practical return to use.",
        primaryAction: "Describe what needs care",
        secondaryAction: "Explore services",
        facts: [
          { label: "Where", value: "Homes, offices & hospitality" },
          { label: "Approach", value: "Assessment-led, on site" },
          { label: "Area", value: "Sofia city" },
        ],
        capacityValue: "≈25 m²",
        capacityLabel: "per hour may be possible",
        capacityNote: "Depending on material, soiling, treatment and access.",
      },
      trustPoints: [
        "Assessment before treatment",
        "Material-conscious decisions",
        "On-site where appropriate",
        "Clear return-to-use guidance",
      ],
      services: {
        eyebrow: "Care by surface",
        title: "One standard of attention. Different material decisions.",
        description:
          "The service starts with what the item is, how it is built and what has happened to it — not a universal cleaning recipe.",
        action: "View all services",
      },
      onSite: {
        eyebrow: "Care that comes to the item",
        title: "Less transport. Less interruption. More context.",
        description:
          "Suitable carpets, rugs and upholstered furniture can often be treated where they already live. That keeps the cleaner close to the room, access conditions and the way the surface is actually used.",
        points: [
          "Many suitable items stay on site",
          "Furniture access is agreed for the job",
          "Portable equipment selected to reduce unnecessary disturbance",
        ],
        note:
          "Some rugs and delicate items may need a specialist route. No promise is made that furniture never needs to move.",
        photoTitle: "Technician working on site",
        photoNote:
          "Future image: real equipment in an occupied Sofia interior, without staged before-and-after claims.",
      },
      reuse: {
        eyebrow: "Faster reuse, responsibly framed",
        title: "The room should get back to its purpose.",
        description:
          "The method is directed toward limiting residual moisture and returning treated surfaces to normal use sooner. Actual timing is explained for the material and conditions, never reduced to one blanket promise.",
        action: "Understand the process",
        factors: [
          "Material",
          "Treatment depth",
          "Airflow",
          "Temperature",
          "Relative humidity",
          "Surface construction",
        ],
      },
      treatments: {
        eyebrow: "Five treatment levels",
        title: "You describe the condition. We assess the treatment.",
        description:
          "A clear vocabulary helps discuss scope without asking customers to prescribe chemistry, agitation or risk for themselves.",
      },
      preservation: {
        eyebrow: "Clean well. Preserve intelligently.",
        title: "Professional maintenance may help preserve appearance and useful life.",
        description:
          "Professional care weighs visible improvement against fibre sensitivity, colourfastness, brushing intensity, chemistry, existing wear and age.",
        formulaLead: "Best reasonable result",
        formulaJoin: "+",
        formulaEnd: "minimum unnecessary material stress",
        points: [
          "Fibre and construction",
          "Colour response",
          "Existing wear",
          "Chemical selection",
          "Agitation intensity",
          "Useful-life preservation",
        ],
        note:
          "Not every stain can be removed safely. Delicate, valuable or uncertain materials may require a gentler plan or specialist assessment.",
      },
      hygiene: {
        eyebrow: "Hygiene-conscious, evidence-conscious",
        title: "Deeper maintenance without medical claims.",
        description:
          "This is a professional fabric-maintenance service, not medical treatment.",
        quote:
          "Deep professional cleaning can help remove accumulated soil, dust and residues that routine vacuuming may leave behind.",
        boundaryLabel: "Claim boundary",
        note:
          "Specific product-performance or personal-health claims remain unpublished until evidence for the actual product and process is reviewed.",
      },
      audiences: {
        eyebrow: "Homes and working spaces",
        title: "The same care standard, adapted to the setting.",
        description:
          "Access, traffic, privacy, timing and return-to-use needs differ. The service plan should reflect that.",
        residential: {
          label: "Residential",
          title: "Care around daily life.",
          text:
            "Apartments, houses, rented homes, landlords, tenants, families and serviced apartments — with clear access needs and practical aftercare.",
          items: ["Carpets and rugs", "Sofas and textile chairs", "Mattresses"],
        },
        business: {
          label: "Business",
          title: "Care around operations.",
          text:
            "Offices, hotels, aparthotels, guest accommodation, property managers and suitable public-facing spaces — planned around access windows.",
          items: ["Phased surface planning", "Early or later requests", "Clear handover guidance"],
        },
      },
      process: {
        eyebrow: "How it works",
        title: "A calm route from description to aftercare.",
        steps: [
          {
            title: "Describe the surface",
            description:
              "Share the item, approximate size, condition, stains, material clues and access needs.",
          },
          {
            title: "Inspect before intensity",
            description:
              "Fibre, colour response, construction, wear and the working environment shape the plan.",
          },
          {
            title: "Confirm the treatment",
            description:
              "The appropriate level and realistic outcome are explained before work proceeds.",
          },
          {
            title: "Clean with control",
            description:
              "Method, chemistry, agitation and moisture are selected for the actual surface.",
          },
          {
            title: "Return to use thoughtfully",
            description:
              "You receive practical ventilation, drying and aftercare guidance for the conditions.",
          },
        ],
      },
      area: {
        eyebrow: "Initially serving Sofia",
        title: "Professional fabric care across the city.",
        description:
          "The initial service area is Sofia city. Surrounding areas may be considered subject to availability; district zones and travel pricing belong to a later pricing phase.",
        action: "View service area",
      },
      faq: {
        eyebrow: "Useful answers",
        title: "Before someone visits.",
        description:
          "Clear expectations are part of professional care — especially around access, stains, drying and delicate materials.",
        action: "Read every question",
      },
    },
    services: {
      hero: {
        eyebrow: "Professional care by surface",
        title: "Different fabrics ask different questions.",
        description:
          "Explore on-site care for carpets, rugs, upholstery and mattresses. Each service begins with material, construction, condition and access — then moves to an appropriate treatment.",
        primaryAction: "Describe what needs care",
      },
      breadcrumbs: { home: "Home", current: "Services" },
      catalogue: {
        eyebrow: "Six service paths",
        title: "Start with the surface, not a sales package.",
        description:
          "These pages explain intended use, care decisions and limitations without turning estimates into guarantees.",
      },
      capacity: {
        eyebrow: "Professional processing",
        title: "Approximately 25 m² per hour may be possible under suitable conditions",
        text:
          "This is not a guaranteed rate or job duration. Material, soiling, selected treatment and access to the surface all affect the pace.",
      },
      treatments: {
        eyebrow: "Treatment vocabulary",
        title: "Intensity is assessed, not self-prescribed.",
        description:
          "The five levels help explain scope while keeping chemistry, mechanical action and risk decisions with the professional assessment.",
      },
    },
    howItWorks: {
      hero: {
        eyebrow: "From context to aftercare",
        title: "A professional process should feel clear before it feels technical.",
        description:
          "The customer explains the situation. The cleaner assesses the material and risk. Together, those inputs create a practical treatment plan.",
        primaryAction: "Submit a service request",
      },
      breadcrumbs: { home: "Home", current: "How it works" },
      stepsIntro: {
        eyebrow: "Six considered steps",
        title: "Enough structure to be dependable. Enough judgement to respect the material.",
      },
      steps: [
        {
          title: "Share useful context",
          description:
            "Describe the item, quantity or area, visible condition, stains, material clues, property and preferred time period. Photos will be added later.",
        },
        {
          title: "Prepare practical access",
          description:
            "Discuss parking, building rules, lifts, security, light furniture and the space needed around the item. Furniture movement is agreed, not assumed.",
        },
        {
          title: "Inspect the material",
          description:
            "Fibre, colour response, construction, backing, seams, wear, previous damage and contamination shape what is safe and worthwhile.",
        },
        {
          title: "Agree the treatment",
          description:
            "The cleaner confirms the treatment level, working sequence, realistic stain expectations and any reason to modify or stop the plan.",
        },
        {
          title: "Clean with control",
          description:
            "Method, chemistry, agitation and moisture are applied proportionately to the actual surface.",
        },
        {
          title: "Handover and aftercare",
          description:
            "You receive practical guidance on ventilation, contact, positioning and return to use based on the material, method and room conditions.",
        },
      ],
      treatmentBand: {
        range: "01—05",
        note: "Five treatment levels communicate intensity and uncertainty.",
        title: "The final level follows inspection.",
        text:
          "A customer describes the surface and concern. The professional determines the appropriate chemistry, moisture and mechanical action after inspection.",
      },
      reuse: {
        eyebrow: "Return to use",
        title: "Drying is not one universal number.",
        description:
          "Material, treatment depth, ventilation, temperature, relative humidity, contamination and surface construction all matter. Guidance reflects the actual job.",
        note:
          "Early and evening appointments depend on the service, address, building rules and team availability.",
      },
    },
    whyProfessional: {
      hero: {
        eyebrow: "Professional judgement",
        title: "Good cleaning is not simply more force.",
        description:
          "The professional difference is the ability to assess a surface, choose proportionate treatment and stop short of unnecessary material stress.",
        primaryAction: "Explore surfaces",
      },
      breadcrumbs: { home: "Home", current: "Why professional care" },
      pillarsIntro: { eyebrow: "Three differences", title: "Assessment. Control. Explanation." },
      pillars: [
        {
          title: "Read the material",
          text: "Fibre, dyes, backing, seams, fillings and existing wear change what a safe result looks like.",
        },
        {
          title: "Control the method",
          text: "Chemistry, agitation, moisture and permitted mechanical action should be proportionate rather than automatic.",
        },
        {
          title: "Explain the outcome",
          text: "A useful handover separates removable soil from permanent wear, colour change or marks that should not be chased aggressively.",
        },
      ],
      preservation: {
        eyebrow: "Preservation is part of performance",
        title: "The cleanest-looking decision is not always the best decision.",
        description: "",
        text:
          "When a mark has changed the material itself, repeated aggressive work can trade a small visual gain for damage. Professional care aims for the best reasonable result while supporting useful life.",
        points: [
          "Fibre sensitivity and colourfastness",
          "Existing wear, age and construction",
          "Brushing intensity and chemical selection",
        ],
        photoTitle: "Close material assessment",
        photoNote:
          "Future image: real fibre, seam and colour-response inspection, without fabricated results.",
      },
      hygiene: {
        eyebrow: "Responsible hygiene language",
        title: "Remove what can be supported. Do not invent a health outcome.",
        description: "",
        text:
          "Deep professional cleaning can help remove accumulated soil, dust and residues that routine vacuuming may leave behind.",
        note:
          "Specific product-performance claims require evidence for the actual product and process before publication. No personal medical result is promised.",
      },
    },
    serviceArea: {
      hero: {
        eyebrow: "Sofia service area",
        title: "On-site fabric care planned around the city.",
        description:
          "The initial service area is Sofia city. Surrounding areas may be considered subject to availability, with exact zones and travel pricing deferred to the pricing phase.",
        primaryAction: "Share your Sofia area",
        visualLabel: "Abstract Sofia service-area visual",
      },
      breadcrumbs: { home: "Home", current: "Service area" },
      coverage: [
        {
          label: "Current intended coverage",
          title: "Sofia city",
          text: "Residential and business customers can submit service needs for staff review across Sofia districts.",
          tone: "primary",
        },
        {
          label: "By discussion",
          title: "Surrounding areas",
          text: "Requests outside the city may be considered subject to route, availability and future pricing rules.",
          tone: "standard",
        },
        {
          label: "Not published yet",
          title: "Zones & travel charges",
          text: "No district supplements or travel fees are published yet. They will follow a reviewed catalogue and pricing model.",
          tone: "deferred",
        },
      ],
      schedule: {
        eyebrow: "Appointment windows",
        title: "Early and evening requests are part of the intended model.",
        description:
          "Appointments depend on the type of service, address, building rules and team availability.",
      },
      placesIntro: {
        eyebrow: "Places we intend to serve",
        title: "From private rooms to working premises.",
        description:
          "This remains a general fabric-care service; specialist healthcare disinfection is outside its scope.",
      },
      places: [
        "Apartments and houses",
        "Tenants and landlords",
        "Offices and waiting areas",
        "Hotels and guest accommodation",
        "Aparthotels and serviced apartments",
        "Suitable restaurants and cafés",
        "Educational and public premises",
        "Property common areas",
      ],
      cta: {
        eyebrow: "Check the route",
        title: "Tell us the district and the surfaces.",
        description:
          "Submitting a request does not confirm availability, calculate a public travel charge or create an appointment.",
      },
    },
    about: {
      hero: {
        eyebrow: "A considered service philosophy",
        title: "Calm expertise for the fabrics people live and work with.",
        description:
          "FabricCare Sofia is designed around professional judgement, useful explanations and the convenience of caring for suitable fabrics on site.",
        primaryAction: "Why professional care",
      },
      breadcrumbs: { home: "Home", current: "About" },
      statement: {
        eyebrow: "The intended standard",
        title:
          "Make the next decision understandable — whether that means cleaning, reducing intensity or recommending a different route.",
      },
      principlesIntro: { eyebrow: "Working principles", title: "Care is a sequence of decisions." },
      principles: [
        { title: "Look before acting", text: "Material, condition and context come before treatment intensity." },
        { title: "Explain uncertainty", text: "Stains, drying and delicate fibres deserve clear limits, not false certainty." },
        { title: "Respect occupied spaces", text: "On-site work should account for access, neighbours, operations and practical return to use." },
        { title: "Preserve useful life", text: "A responsible result balances visible improvement with avoidable wear and material stress." },
      ],
      proof: {
        eyebrow: "Original proof matters",
        title: "Real people, real equipment and permission-based examples.",
        description: "",
        text:
          "Public photography should show actual technicians, genuine on-site work and fabric details. Deliberate placeholders remain until that material is available.",
        note:
          "No years in business, customer counts, awards, certifications, reviews or ratings are claimed at this stage.",
        photoTitle: "The future service team",
        photoNote:
          "Real technicians and equipment, photographed in authentic Sofia settings with permission.",
      },
    },
    faq: {
      hero: {
        eyebrow: "Practical answers",
        title: "Useful expectations before professional care.",
        description:
          "Answers about on-site work, access, timing, stains, delicate materials and the current request-review boundary.",
        primaryAction: "Describe your request",
        countLabel: "carefully framed questions",
      },
      breadcrumbs: { home: "Home", current: "FAQ" },
      certainty: {
        eyebrow: "A note on certainty",
        title: "Inspection may refine any general answer.",
        description:
          "Material, construction, condition, access and room conditions can change what is safe, useful and practical for a specific item.",
      },
      cta: { eyebrow: "Still specific to your item", title: "A description is the right next step." },
    },
    contact: {
      hero: {
        eyebrow: "Contact and service context",
        title: "Start with the surface and the Sofia location.",
        description:
          "Phone and email channels are not yet published. The request form is the available path for submitting details for staff review.",
        primaryAction: "Open request form",
      },
      breadcrumbs: { home: "Home", current: "Contact" },
      cards: {
        phone: { label: "Phone", text: "The approved service number will appear here before telephone enquiries open." },
        email: { label: "Email", text: "The approved service mailbox will appear here before email enquiries open." },
        area: {
          label: "Service area",
          title: "Sofia city",
          text: "Surrounding areas may be considered subject to availability. Travel zones and charges are not yet published.",
        },
        hours: { label: "Intended appointment availability", title: "Approximately 06:00—22:00" },
      },
      visit: {
        eyebrow: "No walk-in office",
        title: "The service is positioned around on-site visits.",
        description: "",
        text:
          "No walk-in customer office is currently published. A future customer-facing location should appear only when it is real and approved for visits.",
        nextLabel: "Best current next step",
        nextTitle: "Describe the item, condition and preferred timing.",
        action: "Submit a request",
      },
    },
    request: {
      hero: {
        eyebrow: "Service request · Staff review required",
        title: "Describe what needs professional care.",
        description:
          "This form sends your information to VAX for staff review. It does not create an automatic quote, appointment, booking or payment.",
        checklistTitle: "Before you start",
        checklist: [
          "Know the Sofia area",
          "Select every relevant surface",
          "Describe stains or delicate material",
          "Choose a preferred time period",
        ],
      },
      breadcrumbs: { home: "Home", current: "Service request" },
      intro: {
        eyebrow: "What happens here",
        title: "Validation, not reservation.",
        description:
          "The server validates the required fields and records a request reference. Staff review is the next step.",
      },
      boundaryLabel: "Request boundary",
      boundaryItems: [
        "A request record for staff review",
        "No file upload",
        "No availability check",
        "No quote or price",
        "No booking confirmation",
      ],
    },
    notFound: {
      eyebrow: "404 · Surface not found",
      title: "This page needs a different route.",
      text: "Return to the public service guide or describe the item that needs care.",
      homeAction: "Return home",
      servicesAction: "Explore services",
    },
  },
  requestForm: {
    notices: {
      errorTitle: "Check the highlighted details.",
      errorText: "The request was not recorded. Check the fields and try again.",
      successTitle: "Your request was received.",
      successText:
        "Keep the request reference. Staff will review the details; no quote, appointment or booking has been confirmed.",
    },
    sections: {
      contact: "Your contact details",
      property: "The property",
      services: "Surfaces that need care",
      condition: "Condition and material",
      timing: "Timing and useful context",
    },
    fields: {
      name: "Name",
      email: "Email",
      phone: "Phone",
      district: "Sofia area or district",
      districtPlaceholder: "For example, Lozenets",
      propertyType: "Property type",
      propertyPlaceholder: "Select a property",
      propertyOptions: {
        apartment: "Apartment",
        house: "House",
        "rented-home": "Rented home",
        office: "Office",
        "hotel-guest-house": "Hotel or guest house",
        "serviced-apartment": "Serviced apartment",
        hospitality: "Restaurant or café",
        "public-space": "Educational or public space",
        other: "Other",
      },
      servicesHint:
        "Choose every surface or item you want to describe. Final scope is confirmed after assessment.",
      estimatedQuantity: "Estimated quantity",
      quantityPlaceholder: "For example, 1 sofa and 6 chairs",
      quantityHint: "A rough quantity is enough for the initial staff review.",
      approximateArea: "Approximate area",
      areaPlaceholder: "For example, around 30 m²",
      areaHint: "Useful for carpets and larger commercial surfaces.",
      condition: "General condition",
      conditionPlaceholder: "Select the closest description",
      stains: "Stains present",
      stainsPlaceholder: "Select an answer",
      stainOptions: { yes: "Yes", no: "No visible stains", unsure: "Not sure" },
      delicateTitle: "This may be delicate, valuable or unusual material.",
      delicateHint:
        "This flags a need for extra assessment; it does not select a treatment level.",
      preferredDate: "Preferred date",
      preferredTime: "Preferred time period",
      timeOptions: {
        "early-morning": "Early morning",
        morning: "Morning",
        afternoon: "Afternoon",
        evening: "Evening",
        flexible: "Flexible",
      },
      notes: "Notes",
      notesPlaceholder:
        "Tell us about materials, stains, access, building rules or anything else that may affect assessment.",
      notesHint: "Do not include payment information or highly sensitive personal data.",
    },
    upload: {
      title: "Photos will be supported in a later phase.",
      text: "No files can be selected, uploaded or stored yet.",
      button: "Add photos — coming later",
    },
    submit: {
      label: "Request for staff review",
      text: "Submitting stores the validated details. It does not create a quote or booking.",
      button: "Submit request",
    },
    validation: {
      nameRequired: "Enter your name.",
      nameTooLong: "Keep the name under 100 characters.",
      emailInvalid: "Enter a valid email address.",
      phoneRequired: "Enter a phone number.",
      phoneTooLong: "Keep the phone number under 32 characters.",
      phoneInvalid: "Use a valid phone-number format.",
      districtRequired: "Enter a Sofia area or district.",
      propertyTypeRequired: "Select a property type.",
      serviceRequired: "Select at least one surface or item.",
      conditionRequired: "Select the general condition.",
      stainsRequired: "Select whether you can see stains.",
      notesTooLong: "Keep notes under 1,500 characters.",
    },
  },
} as const satisfies PublicSiteCopy;
