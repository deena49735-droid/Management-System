const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables from server root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const Criteria = require('../models/Criteria');

const criteriaData = [
  // ==========================================
  // 1. MEMBER LEVEL, meeting_day, frequency weekly
  // ==========================================
  {
    key: 'early_bird',
    name: 'Early Bird @ 7:25 AM',
    category: 'meeting_day',
    points: 20,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: false,
  },
  {
    key: 'highest_giver',
    name: 'Highest Giver',
    category: 'meeting_day',
    points: 50,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: false,
  },
  {
    key: 'highest_referral',
    name: 'Highest Referral',
    category: 'meeting_day',
    points: 50,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: false,
  },
  {
    key: 'highest_one_to_one',
    name: 'Highest One-to-One',
    category: 'meeting_day',
    points: 50,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: false,
  },
  {
    key: 'full_attire',
    name: 'Full Attire (Tie + Pin + Badge)',
    category: 'meeting_day',
    points: 10,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: false,
  },
  {
    key: 'best_30_sec',
    name: 'Best 30-Second Presentation',
    category: 'meeting_day',
    points: 20,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: false,
  },
  {
    key: 'best_attire',
    name: 'Best Attire',
    category: 'meeting_day',
    points: 20,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: false,
  },
  {
    key: 'star_of_week',
    name: 'Star of the Week',
    category: 'meeting_day',
    points: 20,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: false,
  },
  {
    key: 'bringing_visitors',
    name: 'Bringing Visitors',
    category: 'meeting_day',
    points: 50,
    basis: 'per_visitor',
    frequency: 'weekly',
    level: 'member',
    needsProof: false,
  },
  {
    key: 'theme_30_sec',
    name: '30 Sec theme presentation',
    category: 'meeting_day',
    points: 20,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: false,
  },
  {
    key: 'physical_testimonials',
    name: 'Physical Testimonials',
    category: 'meeting_day',
    points: 200,
    basis: 'per_testimonial',
    frequency: 'weekly',
    level: 'member',
    needsProof: false,
  },
  {
    key: 'ask_sheet_photo',
    name: 'Take a photo of your specific ask sheet (With Name)',
    category: 'meeting_day',
    points: 20,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: true,
  },
  {
    key: 'training',
    name: 'Training',
    category: 'meeting_day',
    points: 50,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: false,
  },
  {
    key: 'connecting_specific_ask',
    name: 'Connecting Specific Ask',
    category: 'meeting_day',
    points: 20,
    basis: 'per_specific_ask',
    frequency: 'weekly',
    level: 'member',
    needsProof: false,
  },

  // ==========================================
  // 2. MEMBER LEVEL, non_meeting_day, frequency weekly
  // ==========================================
  {
    key: 'early_morning_health',
    name: 'Early Morning Health Activity (Put Selfie) Min. 4 Days Per Week',
    category: 'non_meeting_day',
    points: 20,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: true,
  },
  {
    key: 'know_our_member',
    name: 'Know Our Member Meeting (Group Photo)',
    category: 'non_meeting_day',
    points: 20,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: true,
  },
  {
    key: 'whatsapp_status',
    name: 'Whatsapp Status Promotion',
    category: 'non_meeting_day',
    points: 20,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: true,
  },
  {
    key: 'power_team_meeting',
    name: 'Power Team Meeting',
    category: 'non_meeting_day',
    points: 20,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: false,
  },
  {
    key: 'team_sports',
    name: 'Team Sports with Members',
    category: 'non_meeting_day',
    points: 20,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: true,
  },
  {
    key: 'team_outing',
    name: 'Team Outing (With Your Team Members Only)',
    category: 'non_meeting_day',
    points: 25,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: true,
  },
  {
    key: 'tea_sapda_polama',
    name: 'Tea sapda polama? Min. 4 Members (With Your Team Members Only)',
    category: 'non_meeting_day',
    points: 25,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: true,
  },
  {
    key: 'cross_chapter',
    name: 'Attending Cross Chapter Meeting (Observer)',
    category: 'non_meeting_day',
    points: 30,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: true,
  },
  {
    key: 'success_story',
    name: 'Posting Success Story message in BNI Kadambas main Group',
    category: 'non_meeting_day',
    points: 100,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: true,
  },
  {
    key: 'sunday_selfie',
    name: 'Sunday selfie with family',
    category: 'non_meeting_day',
    points: 20,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: true,
  },

  // ==========================================
  // 3. TEAM LEVEL, monthly, 1000 each, basis per_team
  // ==========================================
  {
    key: 'kitty_fee_on_time',
    name: 'Kitty fee on time payment',
    category: 'monthly',
    points: 1000,
    basis: 'per_team',
    frequency: 'monthly',
    level: 'team',
    needsProof: false,
  },
  {
    key: 'msp_completion',
    name: 'MSP Completion',
    category: 'monthly',
    points: 1000,
    basis: 'per_team',
    frequency: 'monthly',
    level: 'team',
    needsProof: false,
  },
  {
    key: 'new_member_sponsor',
    name: 'New Member sponsor',
    category: 'monthly',
    points: 1000,
    basis: 'per_team',
    frequency: 'monthly',
    level: 'team',
    needsProof: false,
  },
  {
    key: 'full_present_team',
    name: 'Full Present with whole team',
    category: 'monthly',
    points: 1000,
    basis: 'per_team',
    frequency: 'monthly',
    level: 'team',
    needsProof: false,
  },
  {
    key: 'traffic_light_green',
    name: 'Traffic light Green Score',
    category: 'monthly',
    points: 1000,
    basis: 'per_team',
    frequency: 'monthly',
    level: 'team',
    needsProof: false,
  },

  // ==========================================
  // 4. TEAM LEVEL, one_time, 1000 each, basis per_team
  // ==========================================
  {
    key: 'bni_connect_update',
    name: '100% BNI Connect updation',
    category: 'one_time',
    points: 1000,
    basis: 'per_team',
    frequency: 'one_time',
    level: 'team',
    needsProof: false,
  },
  {
    key: 'contact_save_whatsapp',
    name: '100% Contact Save in Whatsapp',
    category: 'one_time',
    points: 1000,
    basis: 'per_team',
    frequency: 'one_time',
    level: 'team',
    needsProof: false,
  },
  {
    key: 'dance_card_121',
    name: '121 Dance Card Submission',
    category: 'one_time',
    points: 1000,
    basis: 'per_team',
    frequency: 'one_time',
    level: 'team',
    needsProof: false,
  },
  {
    key: 'passport_to_success',
    name: 'Completing passport to success',
    category: 'one_time',
    points: 1000,
    basis: 'per_team',
    frequency: 'one_time',
    level: 'team',
    needsProof: false,
  },
  {
    key: 'follow_social_media',
    name: 'Following Kadambas social media page',
    category: 'one_time',
    points: 1000,
    basis: 'per_team',
    frequency: 'one_time',
    level: 'team',
    needsProof: false,
  },

  // ==========================================
  // 5. MEMBER LEVEL, penalty (points negative)
  // ==========================================
  // Weekly penalties
  {
    key: 'late_after_759',
    name: 'Late after 7:59 AM',
    category: 'penalty',
    points: -100,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: false,
  },
  {
    key: 'absent_weekly_meeting',
    name: 'Absent for Weekly BNI Meeting',
    category: 'penalty',
    points: -100,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: false,
  },
  {
    key: 'missing_pin_badge',
    name: 'Missing Pin & Badge',
    category: 'penalty',
    points: -100,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: false,
  },
  {
    key: 'absent_power_team',
    name: 'Absent for Power Team Meeting',
    category: 'penalty',
    points: -100,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: false,
  },
  {
    key: 'zero_referral',
    name: '0 Referral for the Week',
    category: 'penalty',
    points: -50,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: false,
  },
  {
    key: 'zero_one_to_one',
    name: '0 One-to-One for the Week',
    category: 'penalty',
    points: -50,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: false,
  },
  {
    key: 'walking_out',
    name: 'Walking Out During Meeting',
    category: 'penalty',
    points: -300,
    basis: 'per_member',
    frequency: 'weekly',
    level: 'member',
    needsProof: false,
  },

  // Monthly penalties
  {
    key: 'kitty_unpaid_15th',
    name: 'Kitty Fee Unpaid Before 15th',
    category: 'penalty',
    points: -500,
    basis: 'per_week',
    frequency: 'monthly',
    level: 'member',
    needsProof: false,
  },
  {
    key: 'msp_incomplete',
    name: 'MSP Incomplete',
    category: 'penalty',
    points: -1000,
    basis: 'per_month',
    frequency: 'monthly',
    level: 'member',
    needsProof: false,
  },
  {
    key: 'traffic_light_grey',
    name: 'Traffic Light Score - Grey',
    category: 'penalty',
    points: -3000,
    basis: 'per_member',
    frequency: 'monthly',
    level: 'member',
    needsProof: false,
  },
  {
    key: 'traffic_light_red',
    name: 'Traffic Light Score - Red',
    category: 'penalty',
    points: -1000,
    basis: 'per_member',
    frequency: 'monthly',
    level: 'member',
    needsProof: false,
  },
];

const seedCriteria = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('❌ Error: MONGO_URI is not defined in environment variables.');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB.');

    let insertedCount = 0;
    let existingCount = 0;

    for (const item of criteriaData) {
      // Upsert using $setOnInsert for points so existing custom points are never overwritten
      const result = await Criteria.updateOne(
        { key: item.key },
        {
          $setOnInsert: { points: item.points },
          $set: {
            name: item.name,
            category: item.category,
            basis: item.basis,
            frequency: item.frequency,
            level: item.level,
            needsProof: item.needsProof,
            isActive: true,
          },
        },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        insertedCount++;
      } else {
        existingCount++;
      }
    }

    console.log('========================================');
    console.log('🎉 Criteria seeding completed successfully!');
    console.log(`   New criteria inserted:  ${insertedCount}`);
    console.log(`   Existing criteria kept: ${existingCount} (points preserved)`);
    console.log(`   Total criteria items:   ${criteriaData.length}`);
    console.log('========================================');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding criteria:', error.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

seedCriteria();

