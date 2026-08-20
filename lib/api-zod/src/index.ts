// Barrel for @workspace/api-zod (Orval v8-generated).
//
// `generated/api` exports zod schema *values* (e.g. `const UpdateSpaceBody = zod.object(...)`).
// `generated/types` exports the matching TS *types* (e.g. `interface UpdateSpaceBody`).
// ~61 request shapes (Create*/Update*/Delete*/Get*/List*QueryParams/...) exist under the SAME
// name in both files — a value in api, a type in types. Two `export *` barrels race on those
// names and TypeScript reports TS2308 ("already exported a member ...").
//
// Fix: star-export the bulk of both, then re-export each clashing name's *value* explicitly from
// api. An explicit named export overrides the conflicting `export *` value, leaving `export type *`
// as the sole provider of the type — so each clashing name resolves to value (api) + type (types),
// merged into one symbol, unambiguously. (Do NOT also add an explicit `export type {...}` block —
// it would duplicate the `export type *` star and trigger TS2300.)
//
// ⚠️ Regen note: if Orval adds/removes request shapes, recompute the clash list with
//   comm -12 <(grep -oE '^export const [A-Za-z0-9_]+' generated/api.ts | awk '{print $3}' | sort -u) \
//            <(grep -rhoE '^export (interface|type) [A-Za-z0-9_]+' generated/types/*.ts | awk '{print $3}' | sort -u)
// and update the list below.

export * from "./generated/api";
export type * from "./generated/types";

// Clashing names — re-export the zod schema *value* explicitly so it wins over the api/types
// star ambiguity; the matching type still flows from `export type *` above.
export {
  CancelBookingBody,
  CancelWorkOrderBody,
  CompleteWorkOrderBody,
  ConvertLeadBody,
  CreateAccountBody,
  CreateBeneficiaryBody,
  CreateBookingBody,
  CreateBookingDocumentBody,
  CreateCommissionBody,
  CreateContactBody,
  CreateContractBody,
  CreateContractProductBody,
  CreateInvoiceBody,
  CreateLeadBody,
  CreatePaymentInfoBody,
  CreatePromotionBody,
  CreatePropertyBody,
  CreateServiceHostBody,
  CreateSpaceBody,
  CreateSpaceOptionBody,
  CreateSpacePolicyBody,
  CreateSuburbBody,
  CreateTaskBody,
  CreateWorkOrderBody,
  DeleteBookingParams,
  DeleteLeadParams,
  DeleteServiceHostParams,
  DeleteTaskParams,
  ExtendBookingBody,
  GetBookingParams,
  GetLeadParams,
  GetServiceHostParams,
  GetTaskParams,
  ListBookingsQueryParams,
  ListLeadsQueryParams,
  ListServiceHostsQueryParams,
  ListTasksQueryParams,
  LookupSpacesQueryParams,
  LookupSuburbsQueryParams,
  SignContractBody,
  TerminateContractBody,
  UpdateAccountBody,
  UpdateBeneficiaryBody,
  UpdateBookingParams,
  UpdateCommissionBody,
  UpdateContactBody,
  UpdateInvoiceBody,
  UpdateLeadBody,
  UpdateLeadParams,
  UpdatePaymentInfoBody,
  UpdatePromotionBody,
  UpdatePropertyBody,
  UpdatePropertyStatusBody,
  UpdateServiceHostParams,
  UpdateSpaceBody,
  UpdateSpaceOptionBody,
  UpdateSpacePolicyBody,
  UpdateSuburbBody,
  UpdateTaskBody,
  UpdateTaskParams,
  UpdateWorkOrderBody,
} from "./generated/api";

// 손으로 관리하는 분류표(Orval 생성물이 아니다).
export * from "./workOrderCategories";
