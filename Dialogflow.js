"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chatbotbase_1 = require("chatbotbase");
// TODO split the logic since this is just partially supporting Dialogflow (in fact just Actions on Google)
class Dialogflow extends chatbotbase_1.VoicePlatform {
    platformId() {
        return 'Dialogflow';
    }
    parse(body) {
        console.log("INPUT", body);
        const data = {};
        let inputMethod = chatbotbase_1.InputMethod.text;
        body.result.contexts.forEach(context => {
            if (context.parameters && context.parameters.boxed === true) {
                data[context.name] = context.parameters.value;
            }
            else {
                data[context.name] = context.parameters;
            }
        });
        let platform, text, userId;
        if (body.originalRequest && body.originalRequest.source === 'google') {
            const capabilities = body.originalRequest.data.surface.capabilities;
            platform = 'Google Home';
            for (let i = 0; i < capabilities.length; i++) {
                if (capabilities[i].name === 'actions.capability.SCREEN_OUTPUT') {
                    platform = 'Google Assistant';
                    break;
                }
            }
            //text = body.originalRequest.data.inputs[0].rawInputs[0].query;
            userId = body.originalRequest.data.user.userId;
            const inputs = body.originalRequest.data.inputs;
            for (let i = 0; i < inputs.length; i++) {
                if (inputs[i].rawInputs) {
                    for (let j = 0; j < inputs[i].rawInputs.length; j++) {
                        if (inputs[i].rawInputs[j].query) {
                            text = inputs[i].rawInputs[j].query;
                            switch (inputs[i].rawInputs[j].inputType) {
                                case 'VOICE':
                                    inputMethod = chatbotbase_1.InputMethod.voice;
                                    break;
                                case 'KEYBOARD':
                                    inputMethod = chatbotbase_1.InputMethod.text;
                                    break;
                                case 'TOUCH':
                                    inputMethod = chatbotbase_1.InputMethod.touch;
                                    break;
                            }
                            break;
                        }
                    }
                }
            }
        }
        else if (body.result && body.result.source === 'agent') {
            platform = 'Dialogflow';
            text = body.result.resolvedQuery;
            userId = 'unknown';
        }
        return new chatbotbase_1.Input(body.id, userId, body.sessionId, body.lang || body.originalRequest.data.user.locale, platform, new Date(body.timestamp), body.result.metadata.intentName, inputMethod, text, data, body.originalRequest.data.user.accessToken);
    }
    render(output) {
        let plainReply, formattedReply, messages = [], suggestions = [], context = [], test = [];
        let hasSimpleMessage = false;
        output.replies.forEach(reply => {
            if (reply.platform === '*') {
                if (reply.type === 'plain') {
                    plainReply = reply.render();
                }
                else if (reply.type === 'formatted') {
                    formattedReply = reply.render();
                }
            }
            else if (reply.platform === 'Dialogflow') {
                if (reply.type === 'simpleMessage') {
                    hasSimpleMessage = true;
                }
                if (reply.type === 'listCard') {
                    test.push(reply.render());
                }
                else {
                    messages.push(reply.render());
                }
            }
        });
        output.suggestions.forEach(suggestion => {
            if (suggestion.platform === 'Dialogflow') {
                suggestions.push(suggestion.render());
            }
            else if (suggestion.platform === '*') {
                suggestions.push(Dialogflow.suggestion(suggestion.render()).render());
            }
        });
        for (let key in output.context) {
            let value = output.context[key];
            if ((typeof value) !== 'object') {
                value = { value: value, boxed: true };
            }
            context.push({ name: key, lifespan: 60, parameters: value });
        }
        formattedReply = formattedReply || plainReply;
        // add the plain response if there is no explicit simple response
        if (!hasSimpleMessage) {
            // insert at front
            const newList = [{
                    simpleResponse: {
                        textToSpeech: plainReply,
                        displayText: formattedReply
                    }
                }];
            messages.forEach(msg => newList.push(msg));
            messages = newList;
        }
        // add the plain response for dialogflow
        test.push([{ type: 0, speech: plainReply }]);
        const dialogflowSuggestions = {
            type: 2,
            replies: []
        };
        output.suggestions.forEach(suggestion => {
            if (suggestion.platform === '*') {
                dialogflowSuggestions.replies.push(suggestion.render());
            }
        });
        test.push(dialogflowSuggestions);
        return {
            speech: `<speak>${plainReply}</speak>`,
            displayText: formattedReply || plainReply,
            data: {
                google: {
                    expectUserResponse: output.expectAnswer,
                    noInputPrompts: [],
                    richResponse: {
                        items: messages,
                        suggestions: suggestions
                    }
                }
            },
            messages: test,
            contextOut: context,
            source: "Whatever"
        };
    }
    isSupported(json) {
        return json.hasOwnProperty('originalRequest') || (json.result && json.result.source);
    }
    static simpleReply(message) {
        return {
            platform: 'Dialogflow',
            type: 'simpleMessage',
            render: () => {
                return {
                    simpleResponse: {
                        textToSpeech: message,
                        displayText: message
                    }
                };
            },
            debug: () => message
        };
    }
    static basicCard(title, message, buttons) {
        return {
            platform: 'Dialogflow',
            type: 'basicCard',
            render: () => {
                return {
                    basicCard: {
                        title: title,
                        formattedText: message,
                        buttons: typeof buttons === 'object' ? [buttons] : []
                    }
                };
            },
            debug: () => message
        };
    }
    static basicCardWithPicture(title, message, imageUrl, accessibilityText = "", imageDisplayOptions = ImageDisplays.DEFAULT, buttons) {
        return {
            platform: 'Dialogflow',
            type: 'basicCard',
            render: () => {
                return {
                    basicCard: {
                        title: title,
                        formattedText: message,
                        image: {
                            url: imageUrl,
                            accessibilityText: accessibilityText
                        },
                        buttons: typeof buttons === 'object' ? [buttons] : [],
                        imageDisplayOptions: imageDisplayOptions
                    }
                };
            },
            debug: () => message
        };
    }
    static imageCard(title, message, imageUrl, contentDescription, buttons) {
        return {
            platform: 'Dialogflow',
            type: 'basicCard',
            render: () => {
                return {
                    basicCard: {
                        title: title,
                        formattedText: message,
                        image: {
                            url: imageUrl,
                            accessibility_text: contentDescription
                        },
                        buttons: buttons ? [] : [buttons],
                        imageDisplayOptions: 'CROPPED'
                        // https://github.com/actions-on-google/actions-on-google-nodejs/commit/72dfe485797804e0be921d31822a7fa71234bce7
                    }
                };
            },
            debug: () => 'Dialog with title "' + title + '" and message "' + message + '"'
        };
    }
    static suggestion(suggestion) {
        return {
            platform: 'Dialogflow',
            render: () => {
                return {
                    title: suggestion
                };
            },
            toString: () => suggestion
        };
    }
    static listResponse(cardTitle, list) {
        const items = [];
        list.forEach(item => items.push(item.render()));
        return {
            platform: 'Dialogflow',
            type: 'listCard',
            render: () => {
                return {
                    type: "list_card",
                    platform: "google",
                    title: cardTitle,
                    items: items
                };
            },
            debug: () => 'debug'
        };
    }
}
exports.Dialogflow = Dialogflow;
class DialogflowButton {
    constructor(title, action) {
        this.output = {
            title: title,
            openUrlAction: {
                url: action
            }
        };
    }
    render() {
        return this.output;
    }
}
exports.DialogflowButton = DialogflowButton;
class ListItem {
    constructor(key, title, description, imageUrl) {
        this.key = key;
        this.title = title;
        this.description = description;
        this.imageUrl = imageUrl;
    }
    render() {
        return {
            optionInfo: {
                key: this.key,
                synonyms: []
            },
            title: this.title,
            description: this.description,
            image: {
                url: this.imageUrl
            }
        };
    }
}
exports.ListItem = ListItem;
/**
 * List of possible options to display the image in a BasicCard.
 * When the aspect ratio of an image is not the same as the surface,
 * this attribute changes how the image is displayed in the card.
 * @enum {string}
 */
var ImageDisplays;
(function (ImageDisplays) {
    /**
     * Pads the gaps between the image and image frame with a blurred copy of the
     * same image.
     */
    ImageDisplays["DEFAULT"] = "DEFAULT";
    /**
     * Fill the gap between the image and image container with white bars.
     */
    ImageDisplays["WHITE"] = "WHITE";
    /**
     * Image is centered and resized so the image fits perfectly in the container.
     */
    ImageDisplays["CROPPED"] = "CROPPED";
})(ImageDisplays = exports.ImageDisplays || (exports.ImageDisplays = {}));
//# sourceMappingURL=Dialogflow.js.map