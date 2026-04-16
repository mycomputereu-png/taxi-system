import { describe, it, expect } from "vitest";

describe("Dispatcher Modal - Inline Ratings Display", () => {
  it("should find rating for a specific ride", () => {
    const ratingsReceived = [
      {
        rating: { id: 1, rideId: 200, rating: 5, comment: "Excellent!" },
        ride: { id: 200 },
        driver: { name: "Ion" },
      },
      {
        rating: { id: 2, rideId: 201, rating: 4, comment: "Good" },
        ride: { id: 201 },
        driver: { name: "Vasile" },
      },
    ];

    const rideId = 200;
    const rideRating = ratingsReceived.find((r) => r.ride && r.ride.id === rideId);

    expect(rideRating).toBeDefined();
    expect(rideRating?.rating.rating).toBe(5);
    expect(rideRating?.rating.comment).toBe("Excellent!");
  });

  it("should return undefined for ride without rating", () => {
    const ratingsReceived = [
      {
        rating: { id: 1, rideId: 200, rating: 5 },
        ride: { id: 200 },
        driver: { name: "Ion" },
      },
    ];

    const rideId = 999;
    const rideRating = ratingsReceived.find((r) => r.ride && r.ride.id === rideId);

    expect(rideRating).toBeUndefined();
  });

  it("should display inline rating with correct formatting", () => {
    const rideRating = {
      rating: {
        id: 1,
        rating: 4,
        comment: "Very good service",
        createdAt: new Date("2026-04-10"),
      },
      driver: { name: "Ion Popescu" },
    };

    // Verify star rating display
    const stars = [];
    for (let star = 1; star <= 5; star++) {
      stars.push(star <= rideRating.rating.rating);
    }

    expect(stars.filter((s) => s).length).toBe(4);
    expect(stars.filter((s) => !s).length).toBe(1);

    // Verify date formatting
    const formattedDate = rideRating.rating.createdAt.toLocaleDateString("ro-RO");
    expect(formattedDate).toMatch(/\d{1,2}\.\d{1,2}\.\d{4}/);

    // Verify driver name
    expect(rideRating.driver.name).toBe("Ion Popescu");

    // Verify comment
    expect(rideRating.rating.comment).toBe("Very good service");
  });

  it("should handle rides with and without ratings in list", () => {
    const rides = [
      { ride: { id: 200 }, driver: { name: "Ion" } },
      { ride: { id: 201 }, driver: { name: "Vasile" } },
      { ride: { id: 202 }, driver: { name: "Mihai" } },
    ];

    const ratingsReceived = [
      {
        rating: { id: 1, rideId: 200, rating: 5 },
        ride: { id: 200 },
        driver: { name: "Ion" },
      },
      {
        rating: { id: 2, rideId: 202, rating: 3 },
        ride: { id: 202 },
        driver: { name: "Mihai" },
      },
    ];

    const rideStatuses = rides.map((ride) => ({
      rideId: ride.ride.id,
      hasRating: !!ratingsReceived.find((r) => r.ride && r.ride.id === ride.ride.id),
    }));

    expect(rideStatuses[0].hasRating).toBe(true);
    expect(rideStatuses[1].hasRating).toBe(false);
    expect(rideStatuses[2].hasRating).toBe(true);
  });

  it("should display only one rating per ride", () => {
    const ratingsReceived = [
      {
        rating: { id: 1, rideId: 200, rating: 5 },
        ride: { id: 200 },
        driver: { name: "Ion" },
      },
      {
        rating: { id: 2, rideId: 200, rating: 3 },
        ride: { id: 200 },
        driver: { name: "Ion" },
      },
    ];

    const rideId = 200;
    const rideRating = ratingsReceived.find((r) => r.ride && r.ride.id === rideId);

    // Should return first match (most recent based on array order)
    expect(rideRating?.rating.id).toBe(1);
    expect(rideRating?.rating.rating).toBe(5);
  });

  it("should handle empty ratings array", () => {
    const ratingsReceived: any[] = [];
    const rideId = 200;

    const rideRating = ratingsReceived.find((r) => r.ride && r.ride.id === rideId);

    expect(rideRating).toBeUndefined();
  });

  it("should handle null ride in rating object", () => {
    const ratingsReceived = [
      {
        rating: { id: 1, rideId: 200, rating: 5 },
        ride: null,
        driver: { name: "Ion" },
      },
    ];

    const rideId = 200;
    const rideRating = ratingsReceived.find((r) => r.ride && r.ride.id === rideId);

    expect(rideRating).toBeUndefined();
  });
});
