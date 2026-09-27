import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STARTER_NAMES = ["Alba", "Reggie", "Mo", "Jess", "Tam"];

async function main() {
  await prisma.worldState.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, tick: 0, day: 1 },
  });

  // A few houses and one workplace, spread around a small grid.
  const houses = await Promise.all(
    [
      { x: 1, y: 1 },
      { x: 8, y: 2 },
      { x: 2, y: 7 },
      { x: 9, y: 8 },
      { x: 5, y: 1 },
    ].map((pos) => prisma.building.create({ data: { type: "house", x: pos.x, y: pos.y, capacity: 1 } }))
  );

  const workshop = await prisma.building.create({
    data: { type: "workshop", x: 5, y: 5, capacity: STARTER_NAMES.length },
  });

  for (let i = 0; i < STARTER_NAMES.length; i++) {
    const home = houses[i];
    await prisma.peep.create({
      data: {
        name: STARTER_NAMES[i],
        x: home.x,
        y: home.y,
        homeId: home.id,
        workplaceId: workshop.id,
        job: "worker",
      },
    });
  }

  console.log(`Seeded ${STARTER_NAMES.length} peeps, ${houses.length} houses, and a workshop.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
