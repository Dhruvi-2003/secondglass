package in.refurblens.catalog;

import java.time.Instant;
import com.fasterxml.jackson.annotation.JsonInclude;

/** One source listing or separately priced condition variant. Null/UNKNOWN means undisclosed, never an inferred clean bill of health. */
public record SourceObservation(
    String retailerId, String retailerName, String externalKey, String brand, String model,
    String modelCode, String mount, String coverage, Integer focalMin, Integer focalMax,
    String maxAperture, Boolean autofocus, Boolean stabilized,
    String conditionLabel, String conditionNotes, String fungus, String scratches, String haze,
    String accessories, Integer warrantyMonths, String warrantyDetails, Integer returnDays,
    Long pricePaise, Long shippingPaise, String availability, String sourceUrl, Instant observedAt, boolean demo, String listingType, @JsonInclude(JsonInclude.Include.NON_NULL) ProductRating productRating,
    @JsonInclude(JsonInclude.Include.NON_NULL) ListingDetails listingDetails
) {
    public record DetailEvidence(String field, String text, String sourceUrl, String scope) {}
    public record ListingDetails(String warrantyType, String returnPolicy, String returnDetails, String ratingStatus, java.util.List<DetailEvidence> evidence) {}
    public record ProductRating(Double value, Integer count, String countType) {}
    public SourceObservation(String retailerId, String retailerName, String externalKey, String brand, String model, String modelCode, String mount, String coverage, Integer focalMin, Integer focalMax, String maxAperture, Boolean autofocus, Boolean stabilized, String conditionLabel, String conditionNotes, String fungus, String scratches, String haze, String accessories, Integer warrantyMonths, String warrantyDetails, Integer returnDays, Long pricePaise, Long shippingPaise, String availability, String sourceUrl, Instant observedAt, boolean demo, String listingType) {
        this(retailerId, retailerName, externalKey, brand, model, modelCode, mount, coverage, focalMin, focalMax, maxAperture, autofocus, stabilized, conditionLabel, conditionNotes, fungus, scratches, haze, accessories, warrantyMonths, warrantyDetails, returnDays, pricePaise, shippingPaise, availability, sourceUrl, observedAt, demo, listingType, null, null);
    }
    public SourceObservation(String retailerId, String retailerName, String externalKey, String brand, String model, String modelCode, String mount, String coverage, Integer focalMin, Integer focalMax, String maxAperture, Boolean autofocus, Boolean stabilized, String conditionLabel, String conditionNotes, String fungus, String scratches, String haze, String accessories, Integer warrantyMonths, String warrantyDetails, Integer returnDays, Long pricePaise, Long shippingPaise, String availability, String sourceUrl, Instant observedAt, boolean demo) {
        this(retailerId, retailerName, externalKey, brand, model, modelCode, mount, coverage, focalMin, focalMax, maxAperture, autofocus, stabilized, conditionLabel, conditionNotes, fungus, scratches, haze, accessories, warrantyMonths, warrantyDetails, returnDays, pricePaise, shippingPaise, availability, sourceUrl, observedAt, demo, "USED");
    }
}
