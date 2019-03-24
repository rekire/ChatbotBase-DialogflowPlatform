import { Input, Output, Reply, Suggestion, VoicePermission, VoicePlatform, VerifyDataHolder } from 'chatbotbase';
export declare class Dialogflow extends VoicePlatform {
    platformId(): string;
    parse(body: any): Input;
    private parseApiV1;
    private parseApiV2;
    verify(request: VerifyDataHolder, response: any): Promise<boolean> | boolean;
    render(output: Output): any;
    isSupported(json: any): any;
    requestPermission(reason: string, permissions: VoicePermission | string | (VoicePermission | string)[]): Reply | undefined;
    /**
     * Request an explicit login, if the target platform has the option to explicit log in the user. The Alexa platform
     * supports that this feature since version 0.8 the Dialogflow platform (in fact just Actions on Google) since 0.4
     * and only if the login is not set as mandatory in the Actions on Google console.
     * @returns {boolean} true if it is possible to request the login.
     */
    requestLogin(): boolean | Reply;
    /**
     * Creates a simple response where the spoken text is equal to the shown text.
     * @param message the message the user should read and hear.
     */
    static simpleReply(message: string): Reply;
    /**
     * Creates a basic card holds a title, a messages and optional a button.
     * @param title The title of the card.
     * @param message The message of the card.
     * @param button The button which should be shown (optional).
     */
    static basicCard(title: string, message: string, button?: DialogflowButton): Reply;
    /**
     * Creates a basic card with an image a title, a messages and optional a button.
     * @param title The title of the card.
     * @param message The message of the card.
     * @param imageUrl The url of the image to show.
     * @param accessibilityText The accessibility text for the image.
     * @param imageDisplayOptions The image display options, by default DEFAULT.
     * @param button The button which should be shown (optional).
     */
    static basicCardWithPicture(title: string, message: string, imageUrl: string, accessibilityText: string, imageDisplayOptions?: ImageDisplays, button?: DialogflowButton): Reply;
    static suggestion(suggestion: string): Suggestion;
    static listResponse(cardTitle: string, list: ListItem[]): Reply;
    static getPosition(input: Input): ActionsOnGoogleLocation | null;
    /**
     * Defines a
     * @param ssml
     * @param displayText
     */
    static splittedSimpleReply(ssml: string, displayText: string): Reply;
}
export declare class DialogflowButton {
    private output;
    constructor(title: string, action: string);
    render(): any;
}
export declare class ListItem {
    key: string;
    title: string;
    description: string;
    imageUrl: string;
    constructor(key: string, title: string, description: string, imageUrl: string);
    render(): {
        optionInfo: {
            key: string;
            synonyms: never[];
        };
        title: string;
        description: string;
        image: {
            url: string;
        };
    };
}
/**
 * List of possible options to display the image in a BasicCard.
 * When the aspect ratio of an image is not the same as the surface,
 * this attribute changes how the image is displayed in the card.
 * @enum {string}
 */
export declare enum ImageDisplays {
    /**
     * Pads the gaps between the image and image frame with a blurred copy of the
     * same image.
     */
    DEFAULT = "DEFAULT",
    /**
     * Fill the gap between the image and image container with white bars.
     */
    WHITE = "WHITE",
    /**
     * Image is centered and resized so the image fits perfectly in the container.
     */
    CROPPED = "CROPPED"
}
/**
 * The location of a user as reported by Actions on Google.
 */
export declare class ActionsOnGoogleLocation {
    zipCode: string | null;
    formattedAddress: string | null;
    city: string | null;
    coordinates: ActionsOnGoogleCoordinates;
}
/**
 * The coordinates of the uer as reported by Actions on Google.
 */
export declare class ActionsOnGoogleCoordinates {
    latitude: number;
    longitude: number;
}
