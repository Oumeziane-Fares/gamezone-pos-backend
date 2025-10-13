import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('consoles', (table) => {
    // Add mode column with default '1vs1'
    table.enum('current_mode', ['1vs1', '2vs2']).defaultTo('1vs1').notNullable();
    
    // Add JSON column for mode-specific hourly rates
    table.json('mode_hourly_rates').defaultTo(JSON.stringify({
      '1vs1': 10.00,
      '2vs2': 15.00
    })).notNullable();
    
    // Remove the old single hourly_rate column (we'll keep it for now for backward compatibility)
    // table.dropColumn('hourly_rate'); // Uncomment this after ensuring all data is migrated
  });

  // Update existing consoles with default mode rates
  const consoles = await knex('consoles').select('id', 'hourly_rate');
  
  for (const console of consoles) {
    const modeRates = {
      '1vs1': console.hourly_rate || 10.00,
      '2vs2': (console.hourly_rate || 10.00) * 1.5 // 1.5x rate for 2vs2
    };
    
    await knex('consoles')
      .where('id', console.id)
      .update({
        current_mode: '1vs1',
        mode_hourly_rates: JSON.stringify(modeRates)
      });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('consoles', (table) => {
    table.dropColumn('current_mode');
    table.dropColumn('mode_hourly_rates');
  });
}