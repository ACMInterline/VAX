import type { AuthLocale } from "@/auth/validation";

export type CrmCustomerTypeCode = "INDIVIDUAL" | "BUSINESS";
export type CrmLifecycleStatusCode = "ACTIVE" | "INACTIVE" | "ARCHIVED";
export type CrmContactMethodCode = "EMAIL" | "PHONE" | "NO_PREFERENCE";
export type CrmIdentityRelationshipCode =
  | "OWNER"
  | "PRIMARY_CONTACT"
  | "AUTHORIZED_CONTACT";
export type CrmPropertyTypeCode =
  | "RESIDENTIAL"
  | "OFFICE"
  | "HOTEL_GUEST_ACCOMMODATION"
  | "SERVICED_APARTMENT"
  | "RESTAURANT_CAFE"
  | "COMMERCIAL_PUBLIC"
  | "OTHER";
export type CrmAreaTypeCode =
  | "LIVING_ROOM"
  | "BEDROOM"
  | "DINING_ROOM"
  | "OFFICE"
  | "RECEPTION"
  | "CORRIDOR"
  | "STAIRCASE"
  | "MEETING_ROOM"
  | "HOTEL_ROOM"
  | "OTHER";

export type CrmContent = {
  common: {
    add: string;
    archive: string;
    back: string;
    cancel: string;
    confirm: string;
    create: string;
    edit: string;
    noValue: string;
    reactivate: string;
    save: string;
    saving: string;
    validationSummaryTitle: string;
  };
  list: {
    eyebrow: string;
    title: string;
    intro: string;
    createCustomer: string;
    search: string;
    searchPlaceholder: string;
    customerType: string;
    status: string;
    all: string;
    apply: string;
    clear: string;
    empty: string;
    emptyFiltered: string;
    primaryContact: string;
    properties: string;
    open: string;
    previous: string;
    next: string;
    pageSummary: (page: number, total: number) => string;
  };
  detail: {
    backToCustomers: string;
    overview: string;
    contacts: string;
    properties: string;
    identityAccess: string;
    customerType: string;
    displayName: string;
    legalName: string;
    preferredLocale: string;
    primaryEmail: string;
    primaryPhone: string;
    status: string;
    internalNotes: string;
    internalNotesWarning: string;
    created: string;
    updated: string;
    noContacts: string;
    noProperties: string;
    noIdentityLinks: string;
  };
  forms: {
    customer: {
      createTitle: string;
      editTitle: string;
      identityLegend: string;
      contactLegend: string;
      internalLegend: string;
      customerType: string;
      displayName: string;
      legalName: string;
      legalNameHint: string;
      preferredLocale: string;
      primaryEmail: string;
      primaryPhone: string;
      internalNotes: string;
      internalNotesHint: string;
      initialContactLegend: string;
      contactName: string;
      contactRole: string;
    };
    contact: {
      createTitle: string;
      editTitle: string;
      name: string;
      email: string;
      phone: string;
      roleTitle: string;
      isPrimary: string;
      preferredContactMethod: string;
      locale: string;
      active: string;
    };
    identityLink: {
      title: string;
      intro: string;
      profileId: string;
      profileIdHint: string;
      relationship: string;
      active: string;
      revoked: string;
      link: string;
      revoke: string;
      revokeTitle: string;
      revokeDescription: string;
    };
    property: {
      createTitle: string;
      editTitle: string;
      type: string;
      label: string;
      city: string;
      district: string;
      streetAddress: string;
      postalCode: string;
      latitude: string;
      longitude: string;
      accessNotes: string;
      parkingNotes: string;
      serviceZone: string;
      locationLegend: string;
      operationsLegend: string;
      addressPrivacyHint: string;
    };
    area: {
      createTitle: string;
      editTitle: string;
      type: string;
      customLabel: string;
      customLabelHint: string;
      floorLevel: string;
      notes: string;
      active: string;
    };
    asset: {
      createTitle: string;
      editTitle: string;
      identityLegend: string;
      profileLegend: string;
      conditionLegend: string;
      itemType: string;
      area: string;
      noArea: string;
      label: string;
      approximateLength: string;
      approximateWidth: string;
      approximateArea: string;
      material: string;
      construction: string;
      unknownReference: string;
      colourNotes: string;
      acquisitionOrAge: string;
      delicateOrValuable: string;
      customerCondition: string;
      customerConditionHint: string;
      knownIssues: string;
      riskFlags: string;
      operationalNotes: string;
      noAutomaticPrice: string;
    };
  };
  selfService: {
    eyebrow: string;
    title: string;
    intro: string;
    readOnlyNotice: string;
    notLinkedTitle: string;
    notLinkedText: string;
    noPropertiesTitle: string;
    noPropertiesText: string;
    customer: string;
    property: string;
    address: string;
    areas: string;
    assets: string;
    noAreas: string;
    noAssets: string;
  };
  confirmations: {
    archiveCustomerTitle: string;
    archiveCustomerDescription: string;
    archivePropertyTitle: string;
    archivePropertyDescription: string;
    archiveAssetTitle: string;
    archiveAssetDescription: string;
    deactivateAreaTitle: string;
    deactivateAreaDescription: string;
  };
  action: {
    success: string;
    noChange: string;
    invalid: string;
    forbidden: string;
    notFound: string;
    unavailable: string;
    stale: string;
    invalidRelationship: string;
  };
  labels: {
    customerTypes: Record<CrmCustomerTypeCode, string>;
    lifecycleStatuses: Record<CrmLifecycleStatusCode, string>;
    contactMethods: Record<CrmContactMethodCode, string>;
    identityRelationships: Record<CrmIdentityRelationshipCode, string>;
    propertyTypes: Record<CrmPropertyTypeCode, string>;
    areaTypes: Record<CrmAreaTypeCode, string>;
    activeStates: Record<"ACTIVE" | "INACTIVE", string>;
    locales: Record<AuthLocale, string>;
  };
};

export const crmContent = {
  bg: {
    common: {
      add: "Добави",
      archive: "Архивирай",
      back: "Назад",
      cancel: "Отказ",
      confirm: "Потвърди",
      create: "Създай",
      edit: "Редактирай",
      noValue: "Няма",
      reactivate: "Активирай отново",
      save: "Запази",
      saving: "Запазване…",
      validationSummaryTitle: "Проверете отбелязаните полета",
    },
    list: {
      eyebrow: "Клиентски регистър",
      title: "Клиенти",
      intro:
        "Преглед и управление на клиентски профили, контакти и свързани имоти.",
      createCustomer: "Нов клиент",
      search: "Име или клиентски идентификатор",
      searchPlaceholder: "Търсене",
      customerType: "Тип клиент",
      status: "Статус",
      all: "Всички",
      apply: "Приложи",
      clear: "Изчисти",
      empty: "Все още няма клиентски записи.",
      emptyFiltered: "Няма клиенти, които отговарят на избраните филтри.",
      primaryContact: "Основен контакт",
      properties: "Имоти",
      open: "Отвори клиента",
      previous: "Предишна",
      next: "Следваща",
      pageSummary: (page: number, total: number) =>
        `Страница ${page} · ${total} клиенти`,
    },
    detail: {
      backToCustomers: "Назад към клиентите",
      overview: "Основни данни",
      contacts: "Контакти",
      properties: "Имоти",
      identityAccess: "Достъп на приложни профили",
      customerType: "Тип клиент",
      displayName: "Показвано име",
      legalName: "Юридическо име",
      preferredLocale: "Предпочитан език",
      primaryEmail: "Основен имейл",
      primaryPhone: "Основен телефон",
      status: "Статус",
      internalNotes: "Вътрешно обобщение",
      internalNotesWarning:
        "Видимо е само за упълномощени членове на екипа. Не записвайте пароли, ключове или други тайни.",
      created: "Създаден",
      updated: "Последна промяна",
      noContacts: "Няма добавени контакти.",
      noProperties: "Няма добавени имоти.",
      noIdentityLinks: "Няма свързани приложни профили.",
    },
    forms: {
      customer: {
        createTitle: "Създаване на клиент",
        editTitle: "Редактиране на клиент",
        identityLegend: "Клиентски профил",
        contactLegend: "Основни координати",
        internalLegend: "Вътрешна информация",
        customerType: "Тип клиент",
        displayName: "Показвано име",
        legalName: "Юридическо име",
        legalNameHint: "По избор за фирмен клиент.",
        preferredLocale: "Предпочитан език",
        primaryEmail: "Основен имейл",
        primaryPhone: "Основен телефон",
        internalNotes: "Вътрешно обобщение",
        internalNotesHint:
          "Само за служители. Не въвеждайте пароли, платежни данни или тайни.",
        initialContactLegend: "Основно лице за контакт",
        contactName: "Име на контакта",
        contactRole: "Длъжност или роля",
      },
      contact: {
        createTitle: "Добавяне на контакт",
        editTitle: "Редактиране на контакт",
        name: "Име",
        email: "Имейл",
        phone: "Телефон",
        roleTitle: "Длъжност или роля",
        isPrimary: "Основен контакт",
        preferredContactMethod: "Предпочитан начин за контакт",
        locale: "Език",
        active: "Активен контакт",
      },
      identityLink: {
        title: "Свързване на приложен профил",
        intro:
          "Свързването дава достъп само според избраното отношение. Съвпадащ имейл не създава достъп.",
        profileId: "Идентификатор на приложния профил",
        profileIdHint:
          "Използвайте само идентификатор на VAX приложен профил, не идентификатор от доставчика на вход.",
        relationship: "Отношение към клиента",
        active: "Активна връзка",
        revoked: "Отнета връзка",
        link: "Свържи профила",
        revoke: "Отнеми достъпа",
        revokeTitle: "Отнемане на клиентски достъп",
        revokeDescription:
          "Приложният профил повече няма да има достъп до този клиент. Клиентският запис няма да бъде изтрит.",
      },
      property: {
        createTitle: "Добавяне на имот",
        editTitle: "Редактиране на имот",
        type: "Тип имот",
        label: "Име или обозначение",
        city: "Град",
        district: "Квартал или район",
        streetAddress: "Улица и адрес",
        postalCode: "Пощенски код",
        latitude: "Географска ширина",
        longitude: "Географска дължина",
        accessNotes: "Бележки за достъп",
        parkingNotes: "Бележки за паркиране",
        serviceZone: "Сервизна зона",
        locationLegend: "Адрес",
        operationsLegend: "Оперативна информация",
        addressPrivacyHint:
          "Пълният адрес е чувствителна оперативна информация и е видим само за упълномощени потребители.",
      },
      area: {
        createTitle: "Добавяне на помещение или зона",
        editTitle: "Редактиране на помещение или зона",
        type: "Тип помещение или зона",
        customLabel: "Собствено обозначение",
        customLabelHint: "Използвайте го, когато общият тип не е достатъчно точен.",
        floorLevel: "Етаж или ниво",
        notes: "Бележки",
        active: "Активна зона",
      },
      asset: {
        createTitle: "Добавяне на почистваем актив",
        editTitle: "Редактиране на почистваем актив",
        identityLegend: "Идентичност на актива",
        profileLegend: "Материал и размери",
        conditionLegend: "Описано състояние",
        itemType: "Каноничен тип артикул",
        area: "Помещение или зона",
        noArea: "Без зададена зона",
        label: "Разпознаваемо име",
        approximateLength: "Приблизителна дължина",
        approximateWidth: "Приблизителна ширина",
        approximateArea: "Приблизителна площ",
        material: "Известен материал или влакно",
        construction: "Известна конструкция или финиш",
        unknownReference: "Не е известно",
        colourNotes: "Цвят и външен вид",
        acquisitionOrAge: "Приблизителна възраст или придобиване",
        delicateOrValuable: "Деликатен или ценен актив",
        customerCondition: "Състояние, описано от клиента",
        customerConditionHint:
          "Това е описание от клиента, а не професионална инспекция или потвърдена диагноза.",
        knownIssues: "Известни проблеми",
        riskFlags: "Заявени рискови фактори",
        operationalNotes: "Оперативни бележки",
        noAutomaticPrice:
          "Добавянето на актив не изчислява цена и не създава заявка или резервация.",
      },
    },
    selfService: {
      eyebrow: "Клиентска зона",
      title: "Моите имоти",
      intro: "Преглед на имотите и активите, свързани с вашия приложен профил.",
      readOnlyNotice:
        "Тази зона е само за преглед. За промяна на данни се свържете с екипа.",
      notLinkedTitle: "Профилът не е свързан с клиентски запис",
      notLinkedText:
        "Входът в приложението не създава автоматично клиентски достъп. Упълномощен служител трябва да свърже профила ви.",
      noPropertiesTitle: "Все още няма свързани имоти",
      noPropertiesText:
        "Имате клиентски достъп, но към този клиент все още няма активни имоти.",
      customer: "Клиент",
      property: "Имот",
      address: "Адрес",
      areas: "Помещения и зони",
      assets: "Почистваеми активи",
      noAreas: "Няма добавени помещения или зони.",
      noAssets: "Няма добавени почистваеми активи.",
    },
    confirmations: {
      archiveCustomerTitle: "Архивиране на клиента",
      archiveCustomerDescription:
        "Клиентът ще остане в историята, но няма да бъде активен за нова работа.",
      archivePropertyTitle: "Архивиране на имота",
      archivePropertyDescription:
        "Имотът и свързаните записи ще бъдат запазени, но имотът няма да бъде активен.",
      archiveAssetTitle: "Архивиране на актива",
      archiveAssetDescription:
        "Активът ще остане достъпен за бъдеща история, но няма да бъде активен.",
      deactivateAreaTitle: "Деактивиране на зоната",
      deactivateAreaDescription:
        "Зоната и връзките ѝ ще бъдат запазени, но зоната няма да бъде активна.",
    },
    action: {
      success: "Промяната е запазена.",
      noChange: "Няма промяна; текущите данни вече съвпадат.",
      invalid: "Проверете въведените данни.",
      forbidden: "Нямате право да извършите това действие.",
      notFound: "Записът не е намерен или не е достъпен.",
      unavailable: "Промяната временно не е достъпна. Опитайте отново.",
      stale:
        "Записът е променен след отварянето на формата. Прегледайте новите данни и опитайте отново.",
      invalidRelationship:
        "Избраният свързан запис не принадлежи към този клиент или имот.",
    },
    labels: {
      customerTypes: {
        INDIVIDUAL: "Физическо лице",
        BUSINESS: "Бизнес клиент",
      },
      lifecycleStatuses: {
        ACTIVE: "Активен",
        INACTIVE: "Неактивен",
        ARCHIVED: "Архивиран",
      },
      contactMethods: {
        EMAIL: "Имейл",
        PHONE: "Телефон",
        NO_PREFERENCE: "Без предпочитание",
      },
      identityRelationships: {
        OWNER: "Собственик",
        PRIMARY_CONTACT: "Основен контакт",
        AUTHORIZED_CONTACT: "Упълномощен контакт",
      },
      propertyTypes: {
        RESIDENTIAL: "Жилищен имот",
        OFFICE: "Офис",
        HOTEL_GUEST_ACCOMMODATION: "Хотел или място за настаняване",
        SERVICED_APARTMENT: "Апартамент с обслужване",
        RESTAURANT_CAFE: "Ресторант или кафене",
        COMMERCIAL_PUBLIC: "Търговски или обществен обект",
        OTHER: "Друг тип",
      },
      areaTypes: {
        LIVING_ROOM: "Дневна",
        BEDROOM: "Спалня",
        DINING_ROOM: "Трапезария",
        OFFICE: "Офис",
        RECEPTION: "Рецепция",
        CORRIDOR: "Коридор",
        STAIRCASE: "Стълбище",
        MEETING_ROOM: "Заседателна зала",
        HOTEL_ROOM: "Хотелска стая",
        OTHER: "Друга зона",
      },
      activeStates: {
        ACTIVE: "Активен",
        INACTIVE: "Неактивен",
      },
      locales: {
        bg: "Български",
        en: "Английски",
      },
    },
  },
  en: {
    common: {
      add: "Add",
      archive: "Archive",
      back: "Back",
      cancel: "Cancel",
      confirm: "Confirm",
      create: "Create",
      edit: "Edit",
      noValue: "None",
      reactivate: "Reactivate",
      save: "Save",
      saving: "Saving…",
      validationSummaryTitle: "Check the highlighted fields",
    },
    list: {
      eyebrow: "Customer registry",
      title: "Customers",
      intro: "Review and manage customer profiles, contacts, and linked properties.",
      createCustomer: "New customer",
      search: "Name or customer identifier",
      searchPlaceholder: "Search",
      customerType: "Customer type",
      status: "Status",
      all: "All",
      apply: "Apply",
      clear: "Clear",
      empty: "There are no customer records yet.",
      emptyFiltered: "No customers match the selected filters.",
      primaryContact: "Primary contact",
      properties: "Properties",
      open: "Open customer",
      previous: "Previous",
      next: "Next",
      pageSummary: (page: number, total: number) =>
        `Page ${page} · ${total} customers`,
    },
    detail: {
      backToCustomers: "Back to customers",
      overview: "Core details",
      contacts: "Contacts",
      properties: "Properties",
      identityAccess: "Application profile access",
      customerType: "Customer type",
      displayName: "Display name",
      legalName: "Legal name",
      preferredLocale: "Preferred language",
      primaryEmail: "Primary email",
      primaryPhone: "Primary phone",
      status: "Status",
      internalNotes: "Internal summary",
      internalNotesWarning:
        "Visible only to authorized staff. Do not record passwords, keys, or other secrets.",
      created: "Created",
      updated: "Last changed",
      noContacts: "No contacts have been added.",
      noProperties: "No properties have been added.",
      noIdentityLinks: "No application profiles are linked.",
    },
    forms: {
      customer: {
        createTitle: "Create customer",
        editTitle: "Edit customer",
        identityLegend: "Customer profile",
        contactLegend: "Primary contact details",
        internalLegend: "Internal information",
        customerType: "Customer type",
        displayName: "Display name",
        legalName: "Legal name",
        legalNameHint: "Optional for a business customer.",
        preferredLocale: "Preferred language",
        primaryEmail: "Primary email",
        primaryPhone: "Primary phone",
        internalNotes: "Internal summary",
        internalNotesHint:
          "Staff only. Do not enter passwords, payment details, or secrets.",
        initialContactLegend: "Primary contact person",
        contactName: "Contact name",
        contactRole: "Job title or role",
      },
      contact: {
        createTitle: "Add contact",
        editTitle: "Edit contact",
        name: "Name",
        email: "Email",
        phone: "Phone",
        roleTitle: "Job title or role",
        isPrimary: "Primary contact",
        preferredContactMethod: "Preferred contact method",
        locale: "Language",
        active: "Active contact",
      },
      identityLink: {
        title: "Link application profile",
        intro:
          "Linking grants access only under the selected relationship. A matching email never creates access.",
        profileId: "Application profile identifier",
        profileIdHint:
          "Use a VAX application profile identifier only, not an authentication-provider identifier.",
        relationship: "Customer relationship",
        active: "Active link",
        revoked: "Revoked link",
        link: "Link profile",
        revoke: "Revoke access",
        revokeTitle: "Revoke customer access",
        revokeDescription:
          "The application profile will no longer access this customer. The customer record will not be deleted.",
      },
      property: {
        createTitle: "Add property",
        editTitle: "Edit property",
        type: "Property type",
        label: "Name or label",
        city: "City",
        district: "District or neighbourhood",
        streetAddress: "Street address",
        postalCode: "Postal code",
        latitude: "Latitude",
        longitude: "Longitude",
        accessNotes: "Access notes",
        parkingNotes: "Parking notes",
        serviceZone: "Service zone",
        locationLegend: "Address",
        operationsLegend: "Operational information",
        addressPrivacyHint:
          "The full address is sensitive operational information and is visible only to authorized users.",
      },
      area: {
        createTitle: "Add room or area",
        editTitle: "Edit room or area",
        type: "Room or area type",
        customLabel: "Custom label",
        customLabelHint: "Use this when the general type is not specific enough.",
        floorLevel: "Floor or level",
        notes: "Notes",
        active: "Active area",
      },
      asset: {
        createTitle: "Add cleaning asset",
        editTitle: "Edit cleaning asset",
        identityLegend: "Asset identity",
        profileLegend: "Material and dimensions",
        conditionLegend: "Described condition",
        itemType: "Canonical item type",
        area: "Room or area",
        noArea: "No area assigned",
        label: "Recognizable name",
        approximateLength: "Approximate length",
        approximateWidth: "Approximate width",
        approximateArea: "Approximate area",
        material: "Known material or fibre",
        construction: "Known construction or finish",
        unknownReference: "Not known",
        colourNotes: "Colour and appearance",
        acquisitionOrAge: "Approximate age or acquisition",
        delicateOrValuable: "Delicate or valuable asset",
        customerCondition: "Customer-described condition",
        customerConditionHint:
          "This is a customer description, not a professional inspection or confirmed diagnosis.",
        knownIssues: "Known issues",
        riskFlags: "Reported risk flags",
        operationalNotes: "Operational notes",
        noAutomaticPrice:
          "Adding an asset does not calculate a price or create a request or booking.",
      },
    },
    selfService: {
      eyebrow: "Customer area",
      title: "My properties",
      intro: "Review properties and assets linked to your application profile.",
      readOnlyNotice:
        "This area is read-only. Contact the staff team when information needs to change.",
      notLinkedTitle: "This profile is not linked to a customer record",
      notLinkedText:
        "Signing in does not create customer access automatically. An authorized staff member must link your profile.",
      noPropertiesTitle: "No linked properties yet",
      noPropertiesText:
        "You have customer access, but this customer does not have an active property yet.",
      customer: "Customer",
      property: "Property",
      address: "Address",
      areas: "Rooms and areas",
      assets: "Cleaning assets",
      noAreas: "No rooms or areas have been added.",
      noAssets: "No cleaning assets have been added.",
    },
    confirmations: {
      archiveCustomerTitle: "Archive customer",
      archiveCustomerDescription:
        "The customer will remain in history but will not be active for new work.",
      archivePropertyTitle: "Archive property",
      archivePropertyDescription:
        "The property and linked records will be preserved, but the property will no longer be active.",
      archiveAssetTitle: "Archive asset",
      archiveAssetDescription:
        "The asset will remain available to future history but will no longer be active.",
      deactivateAreaTitle: "Deactivate area",
      deactivateAreaDescription:
        "The area and its links will be preserved, but the area will no longer be active.",
    },
    action: {
      success: "The change was saved.",
      noChange: "No change was needed; the current data already matches.",
      invalid: "Check the information entered.",
      forbidden: "You do not have permission to perform this action.",
      notFound: "The record was not found or is not available to you.",
      unavailable: "The change is temporarily unavailable. Try again.",
      stale:
        "This record changed after the form was opened. Review the latest information and try again.",
      invalidRelationship:
        "The selected linked record does not belong to this customer or property.",
    },
    labels: {
      customerTypes: {
        INDIVIDUAL: "Individual",
        BUSINESS: "Business",
      },
      lifecycleStatuses: {
        ACTIVE: "Active",
        INACTIVE: "Inactive",
        ARCHIVED: "Archived",
      },
      contactMethods: {
        EMAIL: "Email",
        PHONE: "Phone",
        NO_PREFERENCE: "No preference",
      },
      identityRelationships: {
        OWNER: "Owner",
        PRIMARY_CONTACT: "Primary contact",
        AUTHORIZED_CONTACT: "Authorized contact",
      },
      propertyTypes: {
        RESIDENTIAL: "Residential",
        OFFICE: "Office",
        HOTEL_GUEST_ACCOMMODATION: "Hotel or guest accommodation",
        SERVICED_APARTMENT: "Serviced apartment",
        RESTAURANT_CAFE: "Restaurant or café",
        COMMERCIAL_PUBLIC: "Commercial or public site",
        OTHER: "Other",
      },
      areaTypes: {
        LIVING_ROOM: "Living room",
        BEDROOM: "Bedroom",
        DINING_ROOM: "Dining room",
        OFFICE: "Office",
        RECEPTION: "Reception",
        CORRIDOR: "Corridor",
        STAIRCASE: "Staircase",
        MEETING_ROOM: "Meeting room",
        HOTEL_ROOM: "Hotel room",
        OTHER: "Other area",
      },
      activeStates: {
        ACTIVE: "Active",
        INACTIVE: "Inactive",
      },
      locales: {
        bg: "Bulgarian",
        en: "English",
      },
    },
  },
} as const satisfies Record<AuthLocale, CrmContent>;
