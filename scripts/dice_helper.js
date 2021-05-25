import {log_msg as log} from "./util.js";

export function init() {
    log('dice_helper', 'Initializing');
    game.settings.register("ffg-star-wars-enhancements", "dice-helper", {
        name: game.i18n.localize('ffg-star-wars-enhancements.dice-helper'),
        hint: game.i18n.localize('ffg-star-wars-enhancements.dice-helper-hint'),
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });
    log('dice_helper', 'Initialized');
}

export function dice_helper() {
    Hooks.on("renderChatMessage", (app, html, messageData) => {
        /*
        this is slightly less performant than doing the settings check outside of the hook, but if we do it above the
        hook and the user enables it after the game starts, it doesn't actually enable

        we can probably overcome that, but it requires a bunch more work and who has time for that?!
         */
        if (!game.settings.get("ffg-star-wars-enhancements", "dice-helper")) {
            return;
        }

        html.on("click", ".effg-die-result", async function () {
            await dice_helper_clicked(html, messageData);
        });

        if (!is_valid_dice_helper(app, html)) {
            log('dice_helper', 'Detected relevant die roll but the message has already been modified; ignoring');
            return;
        }

        let social_skills = [
            game.i18n.localize('SWFFG.SkillsNameDeception')
        ];
        let combat_skills = [
            /* melee animations */
            game.i18n.localize('SWFFG.SkillsNameBrawl'),
            game.i18n.localize('SWFFG.SkillsNameLightsaber'),
            game.i18n.localize('SWFFG.SkillsNameMelee'),
            /* ranged animations */
            game.i18n.localize('SWFFG.SkillsNameGunnery'),
            game.i18n.localize('SWFFG.SkillsNameRangedHeavy').replace(' ', ' '),
            game.i18n.localize('SWFFG.SkillsNameRangedLight').replace(' ', ' '),
        ];

        let skill = messageData['message']['flavor'].replace('Rolling ', '').replace('...', '').replace(' ', ' ');
        if (combat_skills.indexOf(skill) >= 0) {
            log('dice_helper', 'Detected relevant die roll');
            var data = {
                'advantage': app.roll.ffg.advantage,
                'triumph': app.roll.ffg.triumph,
                'threat': app.roll.ffg.threat,
                'despair': app.roll.ffg.despair,
            };
            if (data['advantage'] > 0 || data['triumph'] > 0 || data['threat'] > 0 || data['despair'] > 0) {
                log('dice_helper', 'Die roll had relevant results, generating new message');
                var msg = {
                    type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                    'content': '<button class="effg-die-result" ' +
                        'data-ad="' + data['advantage'] + '" ' +
                        'data-tr="' + data['triumph'] + '" ' +
                        'data-th="' + data['threat'] + '" ' +
                        'data-de="' + data['despair'] + '"' +
                        '>Help spending results!</button>',
                };
                log('dice_helper', 'New message content: ' + msg['content']);
                ChatMessage.create(msg);
            } else {
                log('dice_helper', 'Die roll didn\'t have relevant results, skipping');
            }
        } else if (social_skills.indexOf(skill)) {
            let rollData = app.roll.ffg;
            if (has_relevant_results(rollData)) {
                log('dice_helper', 'Die roll had relevant results, generating new message');
                let msg = {
                    type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                    content: to_help_button(skill, rollData),
                };
                log('dice_helper', 'New message content: ' + msg['content']);
                ChatMessage.create(msg);
            }
        } else {
            log('dice_helper', 'Detected non-combat die roll, skipping');
        }
    });
}

async function dice_helper_clicked(html, messageData) {
    /**
     * update the content of the "help me spend results" button based on results of the dice roll
     *
     * @param {messageData} ChatMessage object passed in by the hook we're listened to
     */
    log('dice_helper', 'Detected button click; converting to results');
    var data = determine_data(html);
    log('dice_helper', JSON.stringify(data));
    var msg = new ChatMessage(messageData.message);
    messageData.message.content = (await getTemplate('modules/ffg-star-wars-enhancements/templates/dice_helper.html'))(data);
    messageData.message.id = messageData.message._id;
    msg.update(messageData.message);
    log('dice_helper', 'Updated the message');
}

/**
 * read the button metadata to determine results from the associated dice roll
 *
 * @param {jQuery} html - HTML of the ChatMessage as a jQuery instance
 */
const determine_data = (html) => ({
    success: html.attr("data-s"),
    failure: html.attr("data-f"),
    advantage: html.attr("data-ad"),
    triumph: html.attr("data-tr"),
    threat: html.attr("data-th"),
    despair: html.attr("data-de")
})

/**
 * Determines whether the incoming message is valid for use with the Dice Helper
 *
 * @param {Application} app - the current application instance
 * @param {jQuery} html - the ChatMessage as a jQuery instance
 * @param {ChatMessage} messageData - the ChatMessage instance
 *
 * @returns {boolean} true if this is a valid Dice Helper message; false otherwise
 */
function is_valid_dice_helper(app, html, messageData) {
    let isInitiativeRoll = /initiative/i.test(messageData.message.content);
    let isDiceHelperMessage = html.find(".effg-dice-helper").length || html.find(".effg-die-result").length;
    return (game.user.isGM && app.isRoll && !isDiceHelperMessage && !isInitiativeRoll);
}

/**
 * Determine whether the Help button should be shown based on the given roll result
 *
 * @param {Object} rollData - the roll result
 *
 * @returns {boolean} true if the Help button should be shown; false otherwise
 */
function has_relevant_results(rollData) {
    let sum = Object.values(rollData).reduce((sum, val) => sum + val, 0);
    return (sum > 0);
}

/**
 * Transform the given Skill and Roll into the `Help Spending Results!` button
 *
 * @param {string} skill - an identifier for the Skill that was rolled
 * @param {Object} rollData - the roll result
 *
 * @returns {string} Help button html string
 */
const to_help_button = (skill, rollData) =>
    '<button class="effg-die-result" ' +
    `data-s="${rollData.success}" ` +
    `data-f="${rollData.failure}" ` +
    `data-ad="${rollData.advantage}" ` +
    `data-tr="${rollData.triumph}" ` +
    `data-th="${rollData.threat}" ` +
    `data-de="${rollData.despair}" ` +
    `data-skill="${skill}">Help spending results!</button>`
