import {buildTopicPlan} from '../../src/topic';
const topics=process.argv.slice(2);
for(const topic of topics){const p=buildTopicPlan({topicPlanningVersion:1,topic}),a=p.analysis;
 console.log(JSON.stringify({topic,primary:a.primaryIntent,secondary:a.secondaryIntents,mode:a.contentMode,level:a.researchRequirement,families:a.expectedClaimFamilies,writer:p.writerRoute.kind,goal:p.researchRoute.researchGoal,constraints:p.researchRoute.constraints,flags:a.riskFlags,temporal:a.temporalProfile.kind,premise:a.factualityProfile.hypotheticalPremise?.text??null,anchors:a.factualityProfile.realWorldAnchors,sig:p.structuralSignature,interp:a.interpretations}));}
